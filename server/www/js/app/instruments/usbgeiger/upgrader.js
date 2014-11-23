/*
 * (c) 2014 Edouard Lafargue, ed@lafargue.name
 * All rights reserved.
 */
define(function(require) {
    "use strict";
    
    var $        = require('jquery'),
        _       = require('underscore'),
        Backbone = require('backbone'),
        utils   = require('app/utils'),
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
            console.log("Upgraded view closing...");
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
                        //console.log(self.firmware);
                        //console.log(abu.hexdump(intelhex.parse(self.firmware).data));
                    };
                    reader.readAsText(file);
                });
            });
        },
        
        go: function() {
            if (this.firmware.length == 0) {
                utils.showAlert('Error', 'No file selected', 'alert-danger');
                return;
            }
            utils.hideAlert();
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
            
            if (data.sw_version) {
                linkManager.sendCommand({'upload_hex': this.firmware});
            }
        }
    });
});