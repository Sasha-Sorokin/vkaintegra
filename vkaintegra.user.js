// ==UserScript==
// @name     VK Audio Integration
// @description Integrates VK.com audio player with MediaSession API
// @author Sasha Sorokin
// @homepage https://github.com/Sasha-Sorokin/vkaintegra
// @supportURL https://github.com/Sasha-Sorokin/vkaintegra/issues
// @version  1.3.1
// @updateURL https://raw.githubusercontent.com/Sasha-Sorokin/vkaintegra/master/vkaintegra.user.js
// @grant GM.notification
// @grant GM_notification
// @grant GM.setValue
// @grant GM_setValue
// @grant GM.getValue
// @grant GM_getValue
// @include https://vk.com/*
// @run-at document-end
// @noframes
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
        // 16 remix

        let title = htmlDecode(audio[3]);

        const remixType = audio[16];
        if (remixType !== "") title += `- ${htmlDecode(remixType)}`;

        return {
            artist: htmlDecode(audio[4]),
            title,
            artwork: extractArtworks(audio)
        };
    }

    function extractTimes(audio) {
        // 15 durations

        return audio[15];
    }

    const RU_LANG_IDS = [0, 1, 100, 114, 777];

    function isUsingRuLocale() {
        return RU_LANG_IDS.includes(langConfig.id);
    }

    // =====================
    // === NOTIFICATIONS ===
    // =====================

    const UNKNOWN_AUDIO_ICON = "https://i.imgur.com/tTGovqM.png";

    let notificationsAllowed = false;

    let currentNotification = undefined;

    function showNotification(trackMetadata, actualityCallback) {
        console.log("[VKAINTEGRA] Sending notification for", trackMetadata);

        if (!notificationsAllowed) return;

        let icon = trackMetadata.artwork[0].src;

        if (!icon) icon = UNKNOWN_AUDIO_ICON;

        if (currentNotification) currentNotification.close();

        const notification = new Notification(trackMetadata.title, {
            body: `${trackMetadata.artist}\n${trackMetadata.album} · VK`,
            silent: true,
            icon,
            tag: "vk-nowplaying"
        });

        if (!actualityCallback()) {
            notification.close();
        } else {
            currentNotification = notification;

            setTimeout(notification.close.bind(notification), 3000);
        }
    }

    // BUG-5: GM can be different and we must be catchy
    const setValue = (() => {
        try {
            return GM && GM.setValue;
        } catch {
            return GM_setValue;
        }
    })();

    unsafeWindow.vkaDeny = function disableNotifications() {
        const BALLOON_TEXT = isUsingRuLocale()
            ? "Что ж, как пожелаете!"
            : "Well, as you wish!";

        setValue("notifyActivated", false);
        setValue("notifyDlgDone", true);

        showDoneBox(BALLOON_TEXT);
    };

    function activateNotifications() {
        notificationsAllowed = true;

        setValue("notifyDlgDone", true);
        setValue("notifyActivated", true);

        return showDoneBox(
            isUsingRuLocale()
                ? "Уведомления включены!"
                : "Notifications are enabled!"
        );
    }

    unsafeWindow.vkaNotifs = function enableNotifications() {
        if (Notification.permission === "granted") return activateNotifications();

        Notification.requestPermission().then((status) => {
            if (status === "granted") return activateNotifications();

            showDoneBox(
                isUsingRuLocale()
                    ? "Кажется, вы отклонили запрос, либо отключили их в браузере.\n<a href=\"#\" onclick=\"vkaNotifs(); return false;\">Попробовать ещё раз?</a>"
                    : "It seems you have denied request, or disabled it in browser.\n<a href=\"#\" onclick=\"vkaNotifs(); return false;\">Try again?</a>"
            );
        })
    }

    {
        const getValue = (() => {
            try {
                return GM && GM.getValue;
            } catch {
                return GM_getValue;
            }
        })();


        // BUG-6: getValue may be async and not, glad await ignores that
        (async () => {
            // Notification.permission === "granted"
            if (await getValue("notifyActivated", true)) {
                if (Notification.permission === "granted") {
                    notificationsAllowed = true;
                    return;
                }

                setValue("notifyActivated", false);

                showDoneBox(
                    isUsingRuLocale()
                        ? "С момента прошлой активации уведомлений от VK Audio Integration разрешения на отправку этих самых уведомлений больше нет. Уведомления отключены. <a href=\"#\" onclick=\"vkaNotifs(); return false;\">Включить обратно?</a>"
                        : "Since last activation of notifications from VK Audio Integration, there is no more permission to send those notifications, therefore notifications disabled. <a href=\"#\" onclick=\"vkaNotifs(); return false;\">Turn them back on!</a>"
                );
            }

            if (await getValue("notifyDlgDone", false)) return;

            showDoneBox(
                isUsingRuLocale()
                    ? "VK Audio Integration может также отправлять уведомления о текущем проигрываемом треке, но их нужно включить.\n<a href=\"#\" onclick=\"vkaNotifs(); return false;\">Давайте!</a>"
                    : "VK Audio Integration can also send you notifications about currently playing track, but you should enable them.\n<a href=\"#\" onclick=\"vkaNotifs(); return false;\">Let's do it!</a>"
            );

            setValue("notifyDlgDone", true);
        })();
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

    let isStarted = false;

    onPlayerEvent("start", () => {
        isStarted = true;

        bindGeneralHandlers()
    });

    function previousTrack(player) {
        // FEAT-1: Rewind to start instead of playing previous
        if (player.stats.currentPosition > 2) {
            player.seekToTime(0);
        } else {
            player.playPrev();
        }
    }

    function updateControls(player, playlist, track) {
        const audioPosition = playlist.indexOfAudio(track);

        const playlistLength = playlist.getAudiosCount() - 1;

        const noNext = audioPosition === playlistLength;
        const noPrevious = audioPosition === 0;

        if (noNext) resetHandlers("nexttrack");
        else bindHandler("nexttrack", () => player.playNext());

        if (noPrevious) resetHandlers("previoustrack");
        else bindHandler("previoustrack", () => previousTrack(player));
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

        navigator.mediaSession.metadata = new MediaMetadata(trackMetadata);

        setPositionState({
            duration: extractTimes(track).duration
        });

        navigator.mediaSession.playbackState = "playing";

        updateControls(player, playlist, track);

        if (isStarted) showNotification(trackMetadata, () => {
            return player._currentAudio[0] === track[0];
        });
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

        isStarted = false;
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

    // BUG-4: Chrome does not suppert "seek" and throws error
    function setActionHandlerSafe(name, handler) {
        try {
            navigator.mediaSession.setActionHandler(name, handler);
        } catch {
            console.warn(`[VKAINTEGRA] Failed to setActionHandler "${name}", it may not supported in this browser`);
        }
    }

    function bindHandler(name, handler) {
        if (handlerStates[name]) return;

        setActionHandlerSafe(name, handler);

        handlerStates[name] = true;
    }

    function resetHandlers(names) {
        if (names == null) throw new Error("Cannot reset no handlers");

        if (!Array.isArray(names)) names = [names];

        for (let i = 0, l = names.length; i < l; i++) {
            const name = names[i];

            if (!handlerStates[name]) continue;

            setActionHandlerSafe(name, null);

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