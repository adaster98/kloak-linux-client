# Unofficial Kloak Client
This project is designed to tide users over until the release of the official app.<br>
Free and open source.

<img width="1637" height="937" alt="image" src="https://github.com/user-attachments/assets/424e7f75-7b70-452e-935a-1b1d527d15fc" />
More dev photos: https://albums.ente.io/?t=ANSUYEBSD4#6E1i6E1vGUQbh3CRsFBwkd2gzW5tuzUSFESFYv7BaJAw

## Installation:

**Linux:**<br>
1. Download the .Appimage (all distros) or .deb (debian only). <br>
2. Right click and go to properties, check "AAllow executing file as program"<br>
3. Open the file!<br>

**Windows:**<br>
1. Download the Kloak Setup.exe file<br>
2. Right click and Run as Administrator<br>
3. Wait for installation to complete!<br>

## Progress:
Working:
- Login
- Chat
- File upload
- Permissions prompt (sound, screenshare)
- Screenshare
- Audio (Input & Output)
- System tray icon and menu
- Background follows theme 
- Top bar buttons 
- Custom permissions/external-link UI <br>
<sub> Tested audio and screenshare between both my main pc (gentoo) and laptop (cachyos) and it worked perfectly </sub>

TODO/Bugs:
- Drag n drop files not working

## Compiling yourself (linux):
Create build enviroment and clone repo:
```shell
mkdir kloak-client
git clone https://github.com/adaster98/kloak-linux-client
npm imstall
```

Test with:
`npm start`

Build with:
`npm run build`
