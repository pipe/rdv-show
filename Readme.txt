A simple portrait format video call app for pod/video casts.
Aims to be TikTok compatible (in the video layout).
Hosts can have 2 guests.
The video is faded to show the current speaker, the audio is mixed to give 
pseudo stereo positioning if recorded via |pipe|.

The result can be captured by using a screen recording app on the host's machine
or by using a |pipe| service to capture and store it to a server as an mp4.

Still very much a work in progress.

To use:
Open host.html - which will display a dialog (after you grant mic/camera access).
Share the displayed URL with your guests.

Host Notes: 
All the processing is done in the host's browser, so you need a reasonably quick/modern laptop, running chrome or edge.
You _must_ use headphones.
To configure/test audio prefs use avpreflight.html 

Guests Notes: 
Guests can use any webRTC supported browser. 
It is better if they use headphones but it isn't essential
Guests can use mobile phones or laptops.
Guests with headphones _can_ use avpreflight.html to select them

Free to use (no server costs) - unless you need the aditional |pipe| functionality.

