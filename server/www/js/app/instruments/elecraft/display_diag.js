
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
        tpl     = require('text!tpl/instruments/ElecraftDiagView.html'),
        template = null;
        
        try {
            template = _.template(tpl);
        } catch (e) {
            // Will happen if we are packaged in a Chrome app
            template = require('js/tpl/instruments/ElecraftDiagView.js');
        }
    
        // Need to load these, but no related variables.
        require('bootstrap');
        require('bootstrapslider');

    return Backbone.View.extend({

        initialize:function () {
            if (linkManager.isStreaming()) {
                linkManager.stopLiveStream();
            }

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
            
            // Populate fields depending on what we get:
            var da2 = data.substr(0,2);
            var da3 = data.substr(0,3);
            if (da3 == 'RVM') {
                $("#kx3-fw-mcu",this.el).html(data.substr(3));
            } else if (da3 == 'RVD') {
                $("#kx3-fw-dsp",this.el).html(data.substr(3));
            }
        }


    });
    
});