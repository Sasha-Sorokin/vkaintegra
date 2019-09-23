// ==UserScript==
// @name     VK Audio Integration
// @description Integrates VK.com audio player with MediaSession API
// @author Sasha Sorokin
// @homepage https://github.com/Sasha-Sorokin/vkaintegra
// @supportURL https://github.com/Sasha-Sorokin/vkaintegra/issues
// @version  1.0.0
// @updateURL https://raw.githubusercontent.com/Sasha-Sorokin/vkaintegra/master/vkaintegra.user.js
// @grant    none
// @include https://vk.com/*
// @run-at document-end
// @author
// ==/UserScript==

(() => {
    "use strict";

    console.log("[VKAINTEGRA] Initialized...");

    const GENERAL_HANDLERS = ["play", "pause", "previoustrack", "nexttrack", "seek"];

    // =========================
    // === HELPFUL FUNCTIONS ===
    // =========================

    function onPlayerEvent(e, cb) {
        const subId = getAudioPlayer().subscribers.push({ et: e, cb });

        console.log(`[VKAINTEGRA] Bound ot "${e}", subscriber ID #${subId}`);
    }

    function htmlDecode(input) {
        const doc = new DOMParser().parseFromString(input, "text/html");

        return doc.documentElement.textContent;
    }

    function extractArtworks(audio) {
        // 14 artworks

        return audio[14].split(",").map(_ => ({ src: _ }));
    }

    function extractVKMetadata(audio) {
        // 3 title
        // 4 artist

        return {
            artist: htmlDecode(audio[4]),
            title: htmlDecode(audio[3]),
            artwork: extractArtworks(audio)
        };
    }

    function extractTimes(audio) {
        // 15 durations

        return audio[15];
    }

    const setPositionState = navigator.mediaSession.setPositionState
        ? navigator.mediaSession.setPositionState
        : (() => {
            console.log("[VKAINTEGRA] setPositionState is not implemeted!");
            
            return () => {};
        })();

    // =====================
    // === PLAYER EVENTS ===
    // =====================

    onPlayerEvent("start", () => bindGeneralHandlers());

    function updateControls(player, playlist, track) {
        const audioPosition = playlist.indexOfAudio(track);

        const playlistLength = playlist.getAudiosCount() - 1;

        const noNext = audioPosition === playlistLength;
        const noPrevious = audioPosition === 0;

        if (noNext) resetHandlers("nexttrack");
        else bindHandler("nexttrack", () => player.playNext());

        if (noPrevious) resetHandlers("previoustrack");
        else bindHandler("previoustrack", () => player.playPrev());
    }

    function onPlaylistChange() {
        // BUG-2: Shuffle does not fire any events

        const playlist = getAudioPlayer()._currentPlaylist;

        if (playlist == null) return;

        const originalShuffle = playlist.shuffle.bind(playlist);

        playlist.shuffle = (...args) => {
            console.log("[VKAINTEGRA] Caught a shuffle attempt!");

            const player = getAudioPlayer();

            originalShuffle(...args);

            updateControls(player, player._currentPlaylist, player._currentAudio);
        };
    }

    onPlayerEvent("plchange", onPlaylistChange);

    onPlayerEvent("curr", function onTrackChange(track) {
        // Prepare metadata

        const trackMetadata = extractVKMetadata(track);

        const player = getAudioPlayer();

        // Use current playlist name as the album title

        let playlist = player._currentPlaylist;

        // BUG-1: Sometimes we going to deal with referenced playlists
        if (playlist._ref) {
            playlist = playlist._ref;

            // But it's good to us to take a bigger cover image
            // BUG-3: If that's an official album, of course
            if (playlist._isOfficial && playlist._coverUrl !== "") {
                trackMetadata.artwork = [{ src: playlist._coverUrl }];
            }
        }

        trackMetadata.album = playlist._title;

        // Prepare the media session

        console.log(trackMetadata);

        navigator.mediaSession.metadata = new MediaMetadata(trackMetadata);

        setPositionState({
            duration: extractTimes(track).duration
        });

        navigator.mediaSession.playbackState = "playing";

        updateControls(player, playlist, track);
    });

    onPlayerEvent("progress", function onProgress(_progress, duration, position) {
        setPositionState({ duration, playbackRate: 1, position });
    });

    onPlayerEvent("seek", function onSeek(track) {
        setPositionState({
            duration: extractTimes(track).duration,
            playbackRate: 1,
            position: getAudioPlayer()._listenedTime
        });
    });

    onPlayerEvent("pause", function onPause() {
        navigator.mediaSession.playbackState = "paused";
    });

    onPlayerEvent("stop", function onStop() {
        console.log("[VKAINTEGRA] Stopped player, reset state and unbind handlers");

        navigator.mediaSession.playbackState = "none";

        navigator.mediaSession.metadata = undefined;

        resetHandlers(GENERAL_HANDLERS);
    });

    // ===================
    // === POST EVENTS ===
    // ===================

    onPlaylistChange();

    // ==========================
    // === ALL ABOUT HANDLERS ===
    // ==========================

    let generalHandlersBound = false;

    const handlerStates = Object.create(null);

    function bindHandler(name, handler) {
        if (handlerStates[name]) return;

        navigator.mediaSession.setActionHandler(name, handler);

        handlerStates[name] = true;
    }

    function resetHandlers(names) {
        if (names == null) throw new Error("Cannot reset no handlers");

        if (!Array.isArray(names)) names = [names];

        for (let i = 0, l = names.length; i < l; i++) {
            const name = names[i];

            if (!handlerStates[name]) continue;

            navigator.mediaSession.setActionHandler(name, null);

            handlerStates[name] = undefined;
        }

        if (names === GENERAL_HANDLERS) generalHandlersBound = false;
    }

    function bindGeneralHandlers() {
        if (generalHandlersBound) return;

        const player = getAudioPlayer();

        bindHandler("play", () => player.play());

        bindHandler("pause", () => player.pause());

        bindHandler("seek", ({ seekTime }) => player.seekToTime(seekTime));

        generalHandlersBound = true;
    }
})();