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
        utils = require('app/utils'),
        TCPServer = require('app/lib/tcp_server');

    var Output = function () {

        var mappings = null;
        var settings = null;
        var output_ref = null;
        var server = null;
        var openSockets = [];

        // Load the settings for this plugin
        this.setup = function (output) {

            console.log("[Netlink Output plugin] Setup a new instance");
            output_ref = output;
            mappings = output.get('mappings');
            settings = output.get('metadata');

            // Create a rigserver:
            if (server) {
                server.disconnect();
            }
            server = new TCPServer.server(settings.ipaddress, parseInt(settings.port));
            server.start(onRequestCallback);

        };

        this.onClose = function () {
            if (rigserver) {
                console.log('[netlink] Closing existing server');
                server.disconnect();
            }
        }

        // The output manager needs access to this to compute alarm conditions
        // -> not relevant for this plugin.
        this.resolveMapping = function (key, data) {
            return null;
        };


        // In this plugin, we are simply forwarding the data coming from the instrument
        // to the remote end, so we basically send 'data' over the TCP stream
        this.sendData = function (data) {
            if (typeof data != 'object')
                return;
            
            // Write the incoming data into all our sockets:
            for (let i=0; i < openSockets.length; i++) {
                openSockets[i].sendMessage(JSON.stringify(data));
            }
        };

        //////////////////
        // Private methods
        /////////////////

        var onRequestCallback = function (tcpConnection, socketInfo) {
            var info = "[" + socketInfo.peerAddress + ":" + socketInfo.peerPort + "] Connection accepted!";
            console.info(info);

            var onError = function(info) {
                // Destroy our parser.
                console.info("[Netlink] Connection closed/error in driver_backend")
                var i = openSockets.indexOf(tcpConnection);
                openSockets.splice(i,1);
            };

            // Add a reference to this new connection
            openSockets.push(tcpConnection);

            /**
             * This receives data from the remote end: forward to our instrument
             * driver
             */
            var rawParser = function(buffer, c) {
                // Note: this assumes that our link Manager expects strings,
                // which is normally the case.
                linkManager.sendCommand(abu.ab2str(buffer));
            };

            tcpConnection.addDataReceivedListener(function (data) {
                // The raw parser will forward incoming data to the local instrument
                rawParser(data, tcpConnection);
            }, onError);
        };


    }

    _.extend(Output.prototype, Backbone.Events);

    return Output;

});