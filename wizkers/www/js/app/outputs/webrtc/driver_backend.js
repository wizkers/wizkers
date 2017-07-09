/**
 * This file is part of Wizkers.io
 *
 * The MIT License (MIT)
 *  Copyright (c) 2016 Edouard Lafargue, ed@wizkers.io
 *
 * Permission is hereby granted, free of charge, to any person obtaining
 * a copy of this software and associated documentation files (the "Software"),
 * to deal in the Software without restriction, including without limitation
 * the rights to use, copy, modify, merge, publish, distribute, sublicense,
 * and/or sell copies of the Software, and to permit persons to whom the Software
 * is furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
 * WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR
 * IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

/**
 *
 * In-Browser implementation for Chrome and Cordova runmodes
 *
 * @author Edouard Lafargue, ed@lafargue.name
 *
 *
 *  Exposes three methods:
 *
 *  - setup
 *  - sendData
 *  - resolveMapping
 */

define(function (require) {

    "use strict";

    var _ = require('underscore'),
        Backbone = require('backbone'),
        abu = require('app/lib/abutils'),
        utils = require('app/utils');


    require('peerjs'); // Not UMD-friendly, just hardcodes a "Peer" window-level object, ugly.

    var Output = function () {

        var mappings = null;
        var settings = null;
        var output_ref = null;
        var rigserver = null;
        var previouscmd = '';

        var peer = null;
        var activeConnection = null;
        var activeCall = null;

        // Load the settings for this plugin
        this.setup = function (output) {

            console.log("[WebRTC Output plugin] Setup a new instance");
            output_ref = output;
            mappings = output.get('mappings');
            settings = output.get('metadata');

            // If we wanted to talk to the device, we could do it this
            // way:
            //linkManager.sendCommand('command here'); //

            if (settings.instance == 'custom') {
                var sp = settings.ipaddress.split(':');
                var connection_info = {
                    host: sp[0],
                    port: sp[1],
                    debug: true
                };
                if (settings.apikey)
                    connection_info['key'] = settings.apikey;
                peer = new Peer('webrtc-wizkers', connection_info);
            } else {
                // Create a PeerJS connection:
                peer = new Peer('1829384858', {
                    key: settings.apikey,
                    debug: true
                });
            }

            peer.on('open', function (id) {
                console.log('[WebRTC Output] My ID is:', id);
            });

            // Then wait for someone to call us on the data channel
            // and/or audio channel
            peer.on('connection', onPeerConnection);
            peer.on('call', onIncomingCall);

            // TODO

        }

        this.onClose = function () {
            if (peer) {
                console.log('[WebRTC] Closing existing peer connection');
                peer.destroy();
            }
        }

        // The output manager needs access to this to compute alarm conditions
        // -> not relevant for this plugin.
        this.resolveMapping = function (key, data) {
            return null;
        };

        // In this plugin, we just forward all the data coming from
        // the driver to the other end, as long as we are connected
        this.sendData = function (data, isAlarm) {
            // Sending the data here
            if (activeConnection)
                activeConnection.send(data);
        };

        //////////////////
        // Private methods
        /////////////////

        var onPeerConnection = function (conn) {
            console.log('[WebRTC Output] Incoming Peer data connection', conn);
            activeConnection = conn;

            activeConnection.on('data', onIncomingData);
        }

        var onIncomingData = function(data) {
            // data is an ArrayBuffer, forward it to the driver,
            // but convert it to a string first
            console.log('[WebRTC Output] Incoming data:', abu.ab2str(data));
            linkManager.sendCommand(abu.ab2str(data));
        }


        var onIncomingCall = function (call) {
            console.log('[WebRTC Output] Incoming Audio call', call);

            // Time to create our media stream to connect to the incoming call:
            var audioConstraints = {
                audio: {
                    googEchoCancellation: false,
                    googAutoGainControl: false,
                    sourceId: settings.audio_input
                }
            };

            navigator.getUserMedia(audioConstraints,
                function success(audioStream) {
                    call.answer(audioStream);

                    // Then hook up our any incoming audio stream to
                    // our local audio output:
                    call.on('stream', function (stream) {
                        // We need to hook up this incoming stream to an audio element,
                        var audio = $('<audio id="audioSinkElement" autoplay />').appendTo('body');
                        audio[0].src = (URL || webkitURL || mozURL).createObjectURL(stream);

                        // And we need to connect the output of this audio element to the right sink:
                        // (note: right now Chrome does not let us connect a remote WebRTC stream to a
                        // WebAudio node for processing, unfortunately

                        // The media object takes some time to initialize, and apparently there is no good
                        // way to get a signal once it's ready, so we just wait for 1 second before
                        // setting the sink:
                        setTimeout(function () {
                            audio[0].setSinkId(settings.audio_output).then(function () {
                                    console.log('[WebRTC Output] Success, audio output device attached: ', settings.audio_output);
                                })
                                .catch(function (error) {
                                    var errorMessage = error;
                                    if (error.name === 'SecurityError') {
                                        errorMessage = 'You need to use HTTPS for selecting audio output ' +
                                            'device: ' + error;
                                    }
                                    console.log('[WebRTC Output] Error setting audio output', errorMessage);
                                });
                        }, 1000);
                    });


                },
                function error(err) {
                    console.log(err);
                });

        }


    }

    _.extend(Output.prototype, Backbone.Events);

    return Output;

});