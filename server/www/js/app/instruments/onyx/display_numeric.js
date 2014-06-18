// Display output of Geiger counter in numeric format
// 
// (c) 2014 Edouard Lafargue, ed@lafargue.name


define(function(require) {
    "use strict";
    
    var $       = require('jquery'),
        _       = require('underscore'),
        Backbone = require('backbone'),
        utils    = require('app/utils'),
        tpl     = require('text!tpl/instruments/OnyxNumView.html'),
        template = null;
        
        try {
            template = _.template(tpl);
        } catch (e) {
            // Will happen if we are packaged in a Chrome app
            template = require('js/tpl/instruments/OnyxNumView.js', function(){} , function(err) {
                            console.log("Compiled JS preloading error callback.");
                            });
        }

    return Backbone.View.extend({

        initialize:function (options) {

            this.sessionStartStamp = new Date().getTime();
            this.maxreading = 0;
            this.minreading = -1;
            this.valid = false;


            linkManager.on('input', this.showInput, this);

        },

        events: {
        },

        render:function () {
            var self = this;
            console.log('Main render of Onyx numeric view');
            $(this.el).html(template());
            return this;
        },

        onClose: function() {
            console.log("Onyx numeric view closing...");
            linkManager.off('input', this.showInput, this);
        },

        showInput: function(data) {
            if (typeof(data.cpm) == 'undefined')
                return;
            var cpm = parseFloat(data.cpm.value);
            $('#livecpm', this.el).html(cpm.toFixed(3) + "&nbsp;CPM");
            $('#liveusvh', this.el).html((cpm*0.00294).toFixed(3) + "&nbsp;&mu;Sv/h");
            
            // Update "valid" pill only if state changes to save CPU
            if (data.cpm.valid != this.valid) {
                if (data.cpm.valid)
                     $('#readingvalid', this.el).removeClass('label-danger').addClass('label-success').html('VALID');
                else
                    $('#readingvalid', this.el).removeClass('label-success').addClass('label-danger').html('INVALID');
            }

            // Update statistics:
            var sessionDuration = (new Date().getTime() - this.sessionStartStamp)/1000;
            $('#sessionlength',this.el).html(utils.hms(sessionDuration));

            if (cpm > this.maxreading) {
                this.maxreading = cpm;
                $('#maxreading', this.el).html(cpm);
            }
            if (cpm < this.minreading || this.minreading == -1) {
                this.minreading = cpm;
                $('#minreading', this.el).html(cpm);
            }

        },


    });
});