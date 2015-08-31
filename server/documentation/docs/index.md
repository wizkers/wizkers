# Wizkers documentation

Wizkers is a universal open source application for both data visualization and control of various kinds of scientific instruments. Wizkers is a full Javascript/HTML5 application which runs on nearly any computer, phone or tablet. It can also run as a standalone server application, on any Linux platform, from a simple Raspberry Pi or Beaglebone black, all the way to cloud-hosted AWS instances, which gives it tremendous flexibility.

Out of the box, Wizkers supports a variety of instruments, and it can easily be extended to support additional devices.

This documentation covers both [user instructions](userdoc.md) as well as [developer docs](devdoc.md).

![Wizkers connected to a KX3](img/instruments-kx3.png)

## What can Wizkers do?

At the core, Wizkers is designed to interface with various kind of sensors and scientific instruments and visualize and record their data. Wizkers lets you:

* Visualize the readings coming from your sensors and instruments
* Record those readings
* Forward the readings to a variety of backends - from HTTP REST APIs to WebRTC
* Remotely control and configure the sensors and instruments connected to it


## Why Wizkers ?

We created Wizkers for several simple reasons:

* Most of my lab instruments had no decent computer utilities even though they have great connectivity. And those utilities are usually less than user-friendly.
* I create and use many small and not-so-small sensors that generate data, but always had trouble finding good ways to record, visualize and analyze their output
* Most IoT services are all about 'dumb' sensors and nearly free and easy to use APIs, but at the cost of a completely closed backend and limited control on your data once it is sent over. But there are many situations where you want to be able to deploy your own infrastructure without having to rely on a third party, especially if you are not deploying millions of sensors, or you cannot afford 24/7 connectivity.

Another issue I have experienced many times over the last few years, is that most IoT startups cannot provide any kind of continuity and stability for a project: from Pinocc.io to Pachube, Spark.io, Helium.com, etc, most of those companies tend to review and modify their business model every couple of months, and put any project that relies on them at great risk.

Wizkers solves all this issues with one elegant framework: In a nutshell, Wizkers is both the missing link between your sensors, your instruments and the Cloud, as well as the missing universal utility for scientific instruments which works on any OS and any computer.


## Wizkers overview

### Supported instruments

The following instruments are currently supported in Wizkers (as of August 2015):

Instrument name      | Chrome App   | Android App  | Server  |
:--------------------|:-------------|:---------- |:------|
Medcom Onyx          | Yes          |  Yes         |  Yes    |
Medcom Geiger Link   | Yes          |  Yes         |  Yes    |
Medcom Blue Onyx     | Chromebooks only          |  No         |  No    |
Medcom Hawk Nest     | -          |  -         |  Yes    |
Elecraft KX3     | Yes          |  Yes         |  Yes    |
Remote KX3 (Wizkers to Wizkers)    | Yes          |  Not tested         |  Not tested    |
Fluke 287/289     | Yes          |  Yes         |  Yes    |
Fried Circuits USB tester OLED backpack     | Yes          |  Yes         |  Yes    |
Simple serial terminal     | Yes          |  Yes         |  Yes    |
Sark 110 antena analyzer     | Yes          |  Yes        |  Yes    |
Kromek Sigma 25            | Yes | Yes | Yes |



## Installation instructions

Below are installation instructions for the three run modes supported on Wizkers:

### Chrome packaged app

Wizkers can be [downloaded](https://goo.gl/DgLqXH) from the Chrome app store, and is available on any computer that can run Chrome. This includes MacOS, Linux and Windows. 

Chrome packaged apps rely on the Chrome runtime to run - this means you need to have Google Chrome installed on the computer - but otherwise behave as native applications.

### Android app

Wizkers will eventually be available on the Google Play store, but in the mean time, you will have to build Wizkers for Android yourself (refer to the [developer documentation](devdoc.md) for details on how to do this).

### Server

You can also run Wizkers as a standalone server. You then interact with a running Wizkers instance using a web browser. The advantage of running Wizkers in this mode, is that you can leave it connected to instruments 24/7. Server mode supports advanced features such as user management and user rights, multiple open instruments at the same time.

Refer to the [developer documentation](devdoc.md) for instructions on how to checkout Wizkers from Github and build the server version.
