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
        template = require('js/tpl/instruments/USBGeigerUpgrader.js');

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
            $(this.el).html(template());
            return this;
        },

        download_fw: function () {
            var self = this;
            var xhr = new XMLHttpRequest();
            xhr.open('GET', 'http://www.wizkers.io/download/774/', true);
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
            // linkManager.once('status', function() {
            //    linkManager.openInstrument(instrumentManager.getInstrument().id);
            // });

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