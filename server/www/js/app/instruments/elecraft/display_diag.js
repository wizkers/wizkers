
/**
 * Elecraft Diagnostics display. Work in progress
 * (c) 2014 Edouard Lafargue ed@lafargue.name
 */
define(function(require) {
    "use strict";
    
    var $       = require('jquery'),
        _       = require('underscore'),
        Backbone = require('backbone'),
        tpl     = require('text!tpl/instruments/ElecraftDiagView.html'),
        
        template = _.template(tpl);

    return Backbone.View.extend({

        initialize:function () {
            if (linkManager.streaming) {
                linkManager.stopLiveStream();
            }

            linkManager.on('input', this.showInput, this);

            this.render();
        },

        render:function () {
            $(this.el).html(template());
            return this;
        },

        onClose: function() {
            console.log("Elecraft diagnostics view closing...");        
            linkManager.off('input', this.showInput, this);

        },

        events: {
           "click #cmdsend": "sendcmd",
            "keypress input#manualcmd": "sendcmd",
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
        }


    });
    
});