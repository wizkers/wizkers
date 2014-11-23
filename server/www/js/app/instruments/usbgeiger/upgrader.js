/*
 *  An firmware upgrader interface for the Geiger Link.
 *
 *
 * (c) 2014 Edouard Lafargue, ed@lafargue.name
 * All rights reserved.
 */
define(function(require) {
    "use strict";
    
    var $        = require('jquery'),
        _       = require('underscore'),
        Backbone = require('backbone'),
        utils   = require('app/utils'),
        abu = require('app/lib/abutils'),
        intelhex = require('app/lib/intelhex'),
        template = require('js/tpl/instruments/USBGeigerUpgrader.js');
    
    // Upgrader view
    return Backbone.View.extend({
    
        events: {
            "click #device_upgrade": "go",
            "click #file_sel": "select_file",
        },
        
        firmware: "",
        
        initialize: function() {
            if (linkManager.isConnected())
                linkManager.closeInstrument();
            linkManager.on('input', this.showInput, this);
        },
        
        onClose: function() {
            console.log("Upgrader view closing...");
            linkManager.off('input', this.showInput);
            instrumentManager.stopUploader();
        },

        
        render:function () {
            $(this.el).html(template());
            return this;
        },
        
        select_file: function() {
            var self = this;
            var chosenFileEntry = null;

            chrome.fileSystem.chooseEntry({type: 'openFile'}, function(readOnlyEntry) {

                readOnlyEntry.file(function(file) {
                    var reader = new FileReader();
                    reader.onerror = function(e) {
                        console.log(e);
                    };
                    reader.onloadend = function(e) {
                        self.firmware = e.target.result;
                        try {
                            intelhex.parse(self.firmware).data;
                            utils.showAlert('Success', 'Firmware seems valid, click on "Upgrade Firmware" to start the upgrade.',
                                           'bg-success');
                            $("#device_upgrade",self.el).attr('disabled', false).removeClass('btn-danger').addClass('btn-success');
                            
                        } catch (e) {
                            utils.showAlert('Error', 'Invalid firmware file, are you sure you picked the right ".hex" firmware file?',
                                            'bg-danger');
                        }
                        
                    };
                    reader.readAsText(file);
                });
            });
        },
        
        go: function() {
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
            linkManager.once('status', function() {
                linkManager.openInstrument(instrumentManager.getInstrument().id);
            });
            
        },
        
        showInput: function(data) {
            var self = this;

            // Update our raw data monitor
            var i = $('#input',this.el);
            var scroll = (i.val() + JSON.stringify(data) + '\n').split('\n');
            // Keep max 50 lines:
            if (scroll.length > 50) {
                scroll = scroll.slice(scroll.length-50);
            }
            i.val(scroll.join('\n'));
            // Autoscroll:
            i.scrollTop(i[0].scrollHeight - i.height());
            
            // The backend issues a sw_version string as soon as
            // the bootloader is online, we take this as a cue to upload
            // the firmware to the device.
            if (data.sw_version) {
                linkManager.sendCommand({'upload_hex': this.firmware});
            } else if (data.writing) {
                console.log(data.writing);
                $("#prog-flash",this.el).width(data.writing + "%");
            } else if (data.verifying) {
                $("#prog-flash",this.el).width(data.verifying + "%");
            } else if (data.run_mode) {
                if (data.run_mode == 'firmware')
                    utils.showAlert('Success','Firmware Upgrade was successful, device is restarting', 'bg-success');
            } else if (data.status) {
                utils.showAlert('Info', data.status, 'bg-info');
            } 
        }
    });
});