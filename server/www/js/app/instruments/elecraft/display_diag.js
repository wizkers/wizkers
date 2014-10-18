
/**
 * Elecraft Diagnostics display. Work in progress
 * (c) 2014 Edouard Lafargue ed@lafargue.name
 * All rights reserved.
 */
define(function(require) {
    "use strict";
    
    var $       = require('jquery'),
        _       = require('underscore'),
        Backbone = require('backbone'),
        template = require('js/tpl/instruments/ElecraftDiagView.js');
    
        // Need to load these, but no related variables.
        require('bootstrap');
        require('bootstrapslider');
    
    var taking_screenshot = false;
    var pamode_on = false;

    return Backbone.View.extend({

        initialize:function () {
            linkManager.stopLiveStream();
            linkManager.on('input', this.showInput, this);
        },

        render:function () {
            var self = this;
            $(this.el).html(template());
            
            require(['app/instruments/elecraft/equalizer'], function(view) {
                self.ElecraftRXEQ = new view({model: self.model});
                if (self.ElecraftRXEQ != null) {
                    $('#kx3-rxeq', self.el).html(self.ElecraftRXEQ.el);
                    self.ElecraftRXEQ.render();
                }
                /* self.ElecraftTXEQ = new view({model: self.model});
                if (self.ElecraftTXEQ != null) {
                    $('#kx3-txeq', self.el).html(self.ElecraftTXEQ.el);
                    self.ElecraftTXEQ.render();
                }
                */
            });
            
            this.queryKX3();
            
            // Force rendering of KX3 tab, somehow the drawing on the tab does not work
            // very well until I click, otherwise
            $("#kx3").tab();
            
            return this;
        },

        onClose: function() {
            console.log("Elecraft diagnostics view closing...");        
            linkManager.off('input', this.showInput, this);
            //this.ElecraftTXEQ.onClose();
            this.ElecraftRXEQ.onClose();
        },

        events: {
           "click #cmdsend": "sendcmd",
            "keypress input#manualcmd": "sendcmd",
            "click #px3-screenshot": "take_screenshot",
            "click #screenshot": "save_screenshot"
        },
        
        take_screenshot: function() {
            // It looks like screenshots are not reliable when the KX3 and the KXPA100 are talking, so set
            // KXPA100 mode off during transfer
            taking_screenshot = true;
            $('#px3-screenshot').html('Wait...');
            linkManager.manualCommand('MN146;');
            linkManager.manualCommand('MP;');
            // Now wait for the MP value to come back
        },
        
        save_screenshot: function() {
            var cnv = $('#screenshot')[0];
            window.open(cnv.toDataURL(), "screenshot.png");
        },
        
        queryKX3: function() {
            linkManager.manualCommand("RVM;RVD;");
            
        },

        sendcmd: function(event) {
            // We react both to button press & Enter key press
            if ((event.target.id == "manualcmd" && event.keyCode==13) || (event.target.id != "manualcmd"))
                linkManager.manualCommand($('#manualcmd',this.el).val());
        },

        showInput: function(data) {
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
            
            
            
            if (data.screenshot != undefined) {
                // Restore PA Mode from state before screenshot:
                if (pamode_on) {
                    linkManager.manualCommand('MN146;MP001;MN255;');
                }
                // Incoming data from a screenshot
                var height = data.height;
                var width = data.width;
                var cnv = $('#screenshot')[0];
                var ctx = cnv.getContext('2d');
                ctx.canvas.width = width;
                ctx.canvas.height = height;
                var imageData = ctx.createImageData(width,height);

                // Now fill the canvas using our B&W image:
                // Our data is a 272x480 array of 32bit integers that store RGB values
                // as r<<16 | g <<8 | b
                for (var y = 0; y < height; y++) {
                    for (var x = 0; x < width; x++) {
                        // Find pixel index in imageData:
                        var idx = (y * width + x) * 4;
                        imageData.data[idx] = data.screenshot[y][x] >> 16;
                        imageData.data[idx+1] = 0xff & (data.screenshot[y][x] >> 8);
                        imageData.data[idx+2] = 0xff & (data.screenshot[y][x]);
                       imageData.data[idx+3] = 255;  // Alpha
                    }
                }
                ctx.putImageData(imageData,0,0);
                $('#px3-screenshot').html('Take Screenshot');
            } else if (data.downloading != undefined) {
                $('#bmdownload',this.el).width(data.downloading + "%");
            } else {
                // Populate fields depending on what we get:
                var da2 = data.substr(0,2);
                var da3 = data.substr(0,3);
                if (da3 == 'RVM') {
                    $("#kx3-fw-mcu",this.el).html(data.substr(3));
                } else if (da3 == 'RVD') {
                    $("#kx3-fw-dsp",this.el).html(data.substr(3));
                } else if (da2 == 'MP') {
                    if (data.substr(3) === '000') {
                        pamode_on = false;
                    } else
                        pamode_on = true;
                    if (taking_screenshot)  {
                        taking_screenshot = false;
                        // PA Mode off, take screenshot, but we need to wait for the amp to settle
                        linkManager.manualCommand('MP000;MN255;');
                        setTimeout(function() {
                            linkManager.manualCommand('#BMP;'); // PA Mode off, take Screenshot
                        }, 2000);
                    }
                }
            }
        }


    });
    
});