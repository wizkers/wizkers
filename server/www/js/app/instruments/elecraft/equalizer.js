/**
 * Render a RX or TX equalizer for the K3/KX3
 * (c) 2014 Edouard Lafargue, ed@lafargue.name
 * All rights reserved.
 */
define(function(require) {
    "use strict";
    
    var $       = require('jquery'),
        _       = require('underscore'),
        Backbone = require('backbone'),
        template = require('js/tpl/instruments/ElecraftEqualizer.js');
    
        // Need to load these, but no related variables.
        require('bootstrap');
        require('bootstrapslider');

        
 return Backbone.View.extend({

        tagName: "div",
        className: "equalizer slider-bg-info-rev",
    
        initialize: function (options) {
            this.options = options || {};
            
            this.listenTo(linkManager, "input", this.showInput );

        },

        render: function () {
            $(this.el).html(template());
            // Initialize our sliders
            $(".eq",this.el).slider({reversed:true});
            
            this.refresh();
            
            return this;
        },
    
        refresh: function() {
            this.refreshing = true;
            this.band = 0;
            this.bandCommands = [ 19, 27, 20, 28, 21, 29, 32, 33, 34];
            this.bandValues = [ '0.05', '0.10', '0.20', '0.40', '0.80', '1.60', '2.40', '3.20'];
            linkManager.manualCommand("MN008;DB;");
        },

        onClose: function() {
            this.stopListening();
        },

        showInput: function(data) {
            if (this.refreshing) {
                if (data.substr(0,7) == "DBRX EQ") {
                    linkManager.manualCommand("SWT"+this.bandCommands[this.band++]+";DB;");
                } else {
                    var band = data.substr(3,4);
                    var val = parseInt(data.substr(7));
                    console.log("Band " + band + " is " + val);
                    var sliderIndex = this.bandValues.indexOf(band)+1;
                    if (sliderIndex > -1) {
                        $(".eq-" + sliderIndex, this.el).slider('setValue',val);
                    }
                    if (this.band < 9) {
                        linkManager.manualCommand("SWT"+this.bandCommands[this.band++]+";DB;");
                    } else
                        this.refreshing = false;
                }
            }
        },

    });

  
});