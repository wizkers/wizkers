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
            // options can contain a key called "eq" that tells us which EQ to use ('tx' or 'rx')
            // Defaults to 'tx', we only test for 'rx'
            this.options = options || { 'eq': 'tx' };
            
            this.listenTo(linkManager, "input", this.showInput );
            
            this.refreshing = false;
            this.setting_band = 0;

        },
     
        events: {
            "slideStop input.eq": "setBand",
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
            // bandCommands emulates button touches (digit 1 to 8)
            this.bandCommands = [ 19, 27, 20, 28, 21, 29, 32, 33, 34];
            this.bandValues = [ '0.05', '0.10', '0.20', '0.40', '0.80', '1.60', '2.40', '3.20'];
            if (this.options.eq == 'rx') {
                linkManager.manualCommand("MN008;DB;");
            } else {
                linkManager.manualCommand("MN009;DB;");
            }
        },

        onClose: function() {
            this.stopListening();
        },
     
        setBand: function(evt) {
            console.log(evt);
            // Turn the spinner on:
            $(".eq-spinner",this.el).show();
            var band = $(evt.target).data('band');
            this.setting_band = true;
            this.new_band_val = evt.value;
            var cmd = (this.options.eq == 'rx') ? 'MN008;' : 'MN009;';
            cmd += 'SWT' + this.bandCommands[band-1] + ';DB;';
            linkManager.manualCommand(cmd);
            // Now we gotta wait for the callback
        },
     
        showInput: function(data) {
            if (this.setting_band && (data.substr(0,2) == 'DB')) {
                var current_val = parseInt(data.substr(7));
                var diff = this.new_band_val - current_val;
                if (diff == 0) {
                    // We will get this once the band is set
                    this.setting_band = false;
                    $(".eq-spinner",this.el).hide();
                    linkManager.manualCommand('MN255;');
                    return;
                }
                var move = (diff > 0) ? 'UP;' : 'DN;';
                var cmd = '';
               for (var i = 0; i < Math.abs(diff); i++) {
                cmd += move;     
               }
                linkManager.manualCommand(cmd + 'DB;');
                return;
            } else if (this.refreshing) {
                if (data.substr(0,7) == "DBRX EQ" ||
                    data.substr(0,7) == "DBTX EQ" ) {
                    linkManager.manualCommand("SWT"+this.bandCommands[this.band++]+";DB;");
                } else {
                    console.log(data);
                    var band = data.substr(3,4);
                    var val = parseInt(data.substr(7));
                    console.log("Band " + band + " is " + val);
                    var sliderIndex = this.bandValues.indexOf(band)+1;
                    if (sliderIndex > -1) {
                        $(".eq-" + sliderIndex, this.el).slider('setValue',val);
                    }
                    if (this.band < 9) {
                        linkManager.manualCommand("SWT"+this.bandCommands[this.band++]+";DB;");
                    } else {
                        linkManager.manualCommand('MN255;'); // Exit menu
                        this.refreshing = false;
                        this.band = 0;
                        this.trigger('initialized');
                    }
                }
            }
        },

    });

  
});