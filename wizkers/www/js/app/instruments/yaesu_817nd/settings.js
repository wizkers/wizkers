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
 * Extra settings for Elecraft KX3 radios. Polls the browser for a list
 * of input and output devices (microphone and audio)
 */
define(function (require) {
    "use strict";

    var $ = require('jquery'),
        _ = require('underscore'),
        Backbone = require('backbone'),
        template = require('js/tpl/instruments/yaesu_817nd/SettingsView.js');

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