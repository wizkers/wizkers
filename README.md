Wizkers
============

Wizkers is a universal open source application for both data visualization and control of various kinds of scientific instruments. It is a full Javascript/HTML5 application which runs on nearly any computer, phone or tablet.

It can also run as a standalone server application, on any Linux platform, from a simple Raspberry Pi or Beaglebone black, all the way to cloud-hosted AWS instances, which gives it tremendous flexibility. Basically, it is a real open source simple 'cloud' system and one of the only 'cloud' projects out there with a fully open source license for both front-end and backend.

Out of the box, Wizkers supports a variety of instruments, and it can easily be extended to support additional devices.

You will find all the information you need on www.wizkers.io, including a complete user and developer documentation.

Installing
----------

Please refer to the official documentation on http://www.wizkers.io/ for all the details!

Software License
----------------

TL;DR: Wizkers is Open Source software under the terms of the Affero-GPLv3 for the server, and GPLv3 for the client.

Full version:

Wizkers as a project includes both server-side software, and client-side software.  The client-side software can be run on its own, or in conjunction with server-side software, depending on how Wizkers is built and then run (Android app, iOS app, Chrome packaged app, standalone server, etc).

All of the source code of Wizkers present in this distribution is "client-side" EXCEPT for the wizkers/server directory and all its subdirectories.

It would be possible to license all the code of Wizkers under the Affero-GPLv3: the "network server" provision of the Affero-GPLv3 just does not apply to the client-side software, making Affero-GPLv3 essentially identical to GPLv3 in this case.

Nevertheless, in order to avoid applying Affero-GPLv3 to both server and client-side software which has led to confusion amongst users, it was decided to separate the license of both components. Since server code and client code are effectively two completely separate sub-projects, all client-software components of Wizkers are licensed as GPLv3, and all server-side software components as Affero-GPLv3.

Please refer to the online Wizkers documentation for more details on the implications depending on how you build Wizkers, but in a nutshell, if you run Wizkers as an Android app, iOS app or Chrome app, it is GPLv3 licensed software. If you run Wizkers on a server and access it through a browser, the server code is licensed under the Affero-GPLv3.

Besides the COPYING-app and COPYING-server license texts present in this directory, you can also refer to http://www.gnu.org/licenses/recommended-copylefts.html for more details.

Wizkers also relies on an number third party modules and libraries which are dynamically loaded, either on server or client side, and are distributed under their own open source licenses. We have checked that all the licenses of those libraries - and their own dependencies - are compatible with the license terms of the Wizkers code. 