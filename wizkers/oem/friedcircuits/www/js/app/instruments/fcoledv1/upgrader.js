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

/*
 *  An firmware upgrader interface for the Geiger Link.
 *
 *
 * @author Edouard Lafargue, ed@lafargue.name
 */
define(function (require) {
    "use strict";

    var $ = require('jquery'),
        _ = require('underscore'),
        Backbone = require('backbone'),
        utils = require('app/utils'),
        abu = require('app/lib/abutils'),
        intelhex = require('app/lib/intelhex'),
        template = require('js/tpl/instruments/FCOledUpgrader.js');

    // Upgrader view
    return Backbone.View.extend({

        events: {
            "click #device_upgrade": "go",
            "click #file_sel": "select_file",
            "click #fw_dl": "download_fw"
        },

        firmware: "",

        initialize: function () {
            if (linkManager.isConnected()) {
                linkManager.closeInstrument();
            }
            linkManager.on('input', this.showInput, this);
        },

        onClose: function () {
            console.log("Upgrader view closing...");
            linkManager.off('input', this.showInput);
            instrumentManager.stopUploader();
        },


        render: function () {
            this.$el.html(template());
            return this;
        },

        download_fw: function () {
            var self = this;
            var xhr = new XMLHttpRequest();
            xhr.open('GET', 'https://raw.githubusercontent.com/FriedCircuits/FC-USB-Tester-OLED-Backpack/master/USB_Tester_v2/USB_Tester_OLED_128x64.cpp.hex', true);
            xhr.responseType = 'text';

            xhr.onload = function (e) {
                if (this.status == 200) {
                    self.firmware = this.response;
                    self.validate_fw();
                }
            };

            xhr.send();
        },

        select_file: function () {
            var self = this;
            var chosenFileEntry = null;

            chrome.fileSystem.chooseEntry({
                type: 'openFile'
            }, function (readOnlyEntry) {

                readOnlyEntry.file(function (file) {
                    var reader = new FileReader();
                    reader.onerror = function (e) {
                        console.log(e);
                    };
                    reader.onloadend = function (e) {
                        self.firmware = e.target.result;
                        self.validate_fw();
                    };
                    reader.readAsText(file);
                });
            });
        },

        validate_fw: function () {
            try {
                intelhex.parse(this.firmware).data;
                utils.showAlert('Success', 'Firmware seems valid, click on "Upgrade Firmware" to start the upgrade.',
                    'bg-success');
                $("#device_upgrade", this.el).attr('disabled', false).removeClass('btn-danger').addClass('btn-success');

            } catch (e) {
                utils.showAlert('Error', 'Invalid firmware file, are you sure you picked the right ".hex" firmware file?',
                    'bg-danger');
            }
        },

        go: function () {
            if (this.firmware.length == 0) {
                utils.showAlert('Error', 'No file selected', 'bg-danger');
                return;
            }
            utils.hideAlert();
            utils.showAlert('Info', "Starting upgrade, please wait", 'bg-info');
            // Switch to our uploader driver
            instrumentManager.startUploader();
            // Wait until we get a confirmation of driver change and
            // open the instrument to put it in bootloader mode:
            linkManager.once('status', function () {
                linkManager.openBootloader(instrumentManager.getInstrument().id);
            });
        },

        showInput: function (data) {
            var self = this;

            // Update our raw data monitor
            var i = $('#input', this.el);
            var scroll = (i.val() + JSON.stringify(data) + '\n').split('\n');
            // Keep max 50 lines:
            if (scroll.length > 50) {
                scroll = scroll.slice(scroll.length - 50);
            }
            i.val(scroll.join('\n'));
            // Autoscroll:
            i.scrollTop(i[0].scrollHeight - i.height());

            // The backend issues a sw_version string as soon as
            // the bootloader is online, we take this as a cue to upload
            // the firmware to the device.
            if (data.sw_version) {
                linkManager.sendCommand({
                    'upload_hex': this.firmware
                });
            } else if (data.writing) {
                console.log(data.writing);
                $("#prog-flash", this.el).width(data.writing + "%");
            } else if (data.verifying) {
                $("#prog-flash", this.el).width(data.verifying + "%");
            } else if (data.run_mode) {
                if (data.run_mode == 'firmware')
                    utils.showAlert('Success', 'Firmware Upgrade was successful, device is restarting', 'bg-success');
            } else if (data.status) {
                utils.showAlert('Info', data.status, 'bg-info');
            }
        }
    });
});