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
 * Send data to another system through a WebRTC channel
 *
 * This file manages the settings view for settings that are
 * specific to this output, and that are stored in the output's
 * metadata
 *
 *
 * @author Edouard Lafargue, ed@lafargue.name
 */


define(function (require) {

    "use strict";

    var _ = require('underscore'),
        Backbone = require('backbone');

    var template = require('tpl/outputs/WebRTCSettingsView');

    require('webrtc_adapter'); // Load WebRTC adapter shim.

    return Backbone.View.extend({
        initialize: function () {

            this.gotDevices = false;
            this.outputs = [];
            this.inputs = [];

            // Metadata is a simple object looking like this:
            // {  'address': 'name', 'address2': 'name2', etc... }
            this.metadata = this.model.get('metadata');
            if (Object.keys(this.metadata).length == 0) {
                this.metadata = {
                    ipaddress: '127.0.0.1:9000',
                    instance: 'peerjs',
                    audio_input: 'Default',
                    audio_output: 'Default'
                };
                this.model.set('metadata', this.metadata);
            }
            // Query the runtime for our media devices:
            navigator.mediaDevices.enumerateDevices()
                .then(this.gotMediaDevices.bind(this))
                .catch(errorCallback);

            function errorCallback(error) {
                console.log('navigator.getUserMedia error: ', error);
            }
        },

        render: function () {

            this.$el.html(template({
                metadata: this.metadata,
                inputs: this.inputs,
                outputs: this.outputs
            }));
            return this;
        },

        events: {
            "change": "change"
        },

        gotMediaDevices: function (deviceInfos) {
            // Check:
            // github WebRTC examples https://github.com/webrtc/samples/blob/master/src/content/devices/input-output/js/main.js
            ///////
            for (var i = 0; i !== deviceInfos.length; ++i) {
                var deviceInfo = deviceInfos[i];

                if (deviceInfo.kind === 'audioinput') {
                    this.inputs.push({
                        label: deviceInfo.label || 'microphone ' + (audioInputSelect.length + 1),
                        value: deviceInfo.deviceId
                    });
                } else if (deviceInfo.kind === 'audiooutput') {
                    this.outputs.push({
                        label: deviceInfo.label || 'speaker ' + (audioOutputSelect.length + 1),
                        value: deviceInfo.deviceId
                    });
                } else {
                    console.log('Some other kind of source/device: ', deviceInfo);
                }
            }
            this.gotdevices = true;
            this.render();

        },

        change: function (event) {
            console.log("WebRTC output bespoke settings change");

            // Apply the change to the metadata
            var target = event.target;
            this.metadata[target.name] = target.value;
            this.model.set('metadata', this.metadata);

            // This view is embedded into another view, so change events
            // are going to bubble up to the upper view and change attributes
            // with the same name, so we stop event propagation here:
            if (target.name != "numfields")
                event.stopPropagation();

        },
    });
});