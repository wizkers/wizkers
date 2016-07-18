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
 * Extra settings for Elecraft KX3 radios. Polls the browser for a list
 * of input and output devices (microphone and audio)
 */
define(function (require) {
    "use strict";

    var template = require('js/tpl/instruments/elecraft/ElecraftSettingsView.js');

    require('webrtc_adapter'); // Load WebRTC adapter shim.


    return Backbone.View.extend({

        initialize: function (options) {
            this.gotdevices = false;

            // We support two sound card sets:
            // - One to connect the radio to the computer
            // - One for local audio output (computer speakers for instance), and
            //     local audio input (microphone input for instance)
            if (this.model.get('audio_input') == undefined) {
                this.model.set('audio_input','n.a.');
            }
            if (this.model.get('audio_output') == undefined) {
                this.model.set('audio_output','n.a.');
            }
            if (this.model.get('op_audio_input') == undefined) {
                this.model.set('op_audio_input','n.a.');
            }
            if (this.model.get('op_audio_output') == undefined) {
                this.model.set('op_audio_output','n.a.');
            }
            this.outputs = [];
            this.inputs = [];

            // Our adapter shim forces us to use promises. Good opporunity
            // to learn:
            navigator.mediaDevices.enumerateDevices()
                .then(this.gotDevices.bind(this))
                .catch(errorCallback);

            function errorCallback(error) {
                console.log('navigator.getUserMedia error: ', error);
            }

        },

        render: function () {
            if (!this.gotdevices)
                return; // We delay rendering until we get the media devices back


            this.$el.html(template(_.extend(this.model.toJSON(), {
                inputs: this.inputs,
                outputs: this.outputs,
            })));
            return this;
        },

        gotDevices: function (deviceInfos) {
            // Check:
            // github WebRTC examples https://github.com/webrtc/samples/blob/master/src/content/devices/input-output/js/main.js
            ///////
            for (var i = 0; i !== deviceInfos.length; ++i) {
                var deviceInfo = deviceInfos[i];

                if (deviceInfo.kind === 'audioinput') {
                    this.inputs.push({ label: deviceInfo.label || 'microphone ' + (audioInputSelect.length + 1),
                                       value: deviceInfo.deviceId
                                     });
                } else if (deviceInfo.kind === 'audiooutput') {
                    this.outputs.push({ label: deviceInfo.label || 'speaker ' + (audioOutputSelect.length + 1),
                                        value: deviceInfo.deviceId
                                      });
                } else {
                    console.log('Some other kind of source/device: ', deviceInfo);
                }
            }
            this.gotdevices = true;
            this.render();
        }
    });
});