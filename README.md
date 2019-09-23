# VK.com integration with MediaSession

[🇷🇺 По-русски →](/README.ru.md)

> This userscript integrates VK.com Audio Player with new [MediaSession API](https://w3c.github.io/mediasession/). It is highly useful if you already use desktop integration extension for your desktop desktop environment (for example, [Plasma Browser Integration for KDE](https://community.kde.org/Plasma/Browser_Integration)).

|         Without userscript          |         Using userscript         |
| :---------------------------------: | :------------------------------: |
| ![Screenshot](examples/without.jpg) | ![Screenshot](examples/with.jpg) |
| <ul><li>Cannot really control media, only seeking</li><li>No title or artist name neither</li></ul> | <ul><li>Dynamically changing controls</li><li>Cover<sup>**1**</sup>, artist, title and album/playlist name</li></ul> |

<sup>1</sup> *Unfortunately, VK does not download data about album for tracks played not from albums, only small cover image is available, whereas you play tracks from albums, the the large cover is being loaded. There is no easy fix for this.*

## How do I use it?

You have to install userscript with the preferred extension ([Tampermonkey](https://www.tampermonkey.net/), [Greasemonkey](https://www.greasespot.net/), [Violentmonkey](https://violentmonkey.github.io/)). Clicking on the following button with extension installed will open you an installation window.

[![Installation button](https://img.shields.io/badge/VK%20Audio%20Integration-Install-brightgreen)](https://github.com/Sasha-Sorokin/vkaintegra/raw/master/vkaintegra.user.js)

**You still need system-wide integration which will use provided data.** KDE provides Plasma Browser Integration extension for Firefox and Chrome, which uses data from MediaSession along with monitoring web page audio and video elements to provide you controls and display media info. [Read more →](https://mastodon.technology/@kde/101985925180129532)

## Reporting issues

The userscript relies on exposed VK.com site API without any documentation, therefore it may not work correctly in some situations. If you have any issues with this userscript, please report them in [Issues section →](https://github.com/Sasha-Sorokin/vkaintegra/issues)
