/**
 * (c) 2015 Edouard Lafargue, ed@lafargue.name
 *
 * This file is part of Wizkers.
 *
 * Wizkers is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * Wizkers is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *  GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Wizkers.  If not, see <http://www.gnu.org/licenses/>.
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
                peer = new Peer('webrtc-wizkers', {
                    host: sp[0],
                    port: sp[1],
                    debug: true
                });
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
        this.sendData = function (data) {
            // Sending the data here (TODO)
            if (activeConnection)
                activeConnection.send(data);
        };

        //////////////////
        // Private methods
        /////////////////

        var onPeerConnection = function (conn) {
            console.log('[WebRTC Output] Incoming Peer data connection', conn);
            activeConnection = conn;
        }


        var onIncomingCall = function (call) {
            console.log('[WebRTC Output] Incoming Audio call', call);

            // Time to create our media stream to connect to the incoming call:

            var audioConstraints = {
                audio: {
                    echoCancellation: false,
                    deviceId: settings.audio_input
                }
            };

            navigator.getUserMedia(audioConstraints,
                function success(audioStream) {
                call.answer(audioStream);
            },
                function error(err) {
                    console.log(err);
                });

        }


    }

    _.extend(Output.prototype, Backbone.Events);

    return Output;

});