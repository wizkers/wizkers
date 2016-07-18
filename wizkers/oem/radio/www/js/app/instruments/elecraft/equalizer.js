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

/**
 * Render a RX or TX equalizer for the K3/KX3
 * @author Edouard Lafargue, ed@lafargue.name
 */
define(function(require) {
    "use strict";

    var template = require('js/tpl/instruments/elecraft/ElecraftEqualizer.js');

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
            this.$el.html(template());
            // Initialize our sliders
            this.$(".eq").slider({reversed:true});
            linkManager.sendCommand('AI1;');
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
                linkManager.sendCommand("MD;MN008;DB;");
            } else {
                linkManager.sendCommand("MD;MN009;DB;");
            }
        },

        onClose: function() {
            this.stopListening();
            linkManager.sendCommand('AI0;');
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
            linkManager.sendCommand(cmd);
            // Now we gotta wait for the callback
        },

        showInput: function(data) {
            if (!this.$el.is(':visible')) {
                return;
            }

            if (this.setting_band && (data.raw.substr(0,2) == 'DB')) {
                var current_val = parseInt(data.raw.substr(7));
                var diff = this.new_band_val - current_val;
                if (diff == 0) {
                    // We will get this once the band is set
                    this.setting_band = false;
                    $(".eq-spinner",this.el).hide();
                    linkManager.sendCommand('MN255;');
                    return;
                }
                var move = (diff > 0) ? 'UP;' : 'DN;';
                var cmd = '';
               for (var i = 0; i < Math.abs(diff); i++) {
                cmd += move;
               }
                linkManager.sendCommand(cmd + 'DB;');
                return;
            } else if (data.raw.substr(0,2) == 'IF') {
                // We want the mode:
                var m = parseInt(data.raw.substr(29,1));
                if (m == 6 || m == 9) {
                    // Disable EQ when we're in data mode, since it cannot be
                    // adjusted
                    this.$el.css({'opacity': '0.3', 'pointer-events': 'none'});
                } else {
                    this.$el.css({'opacity': '1', 'pointer-events': ''});
                }
            } else if (data.raw.substr(0,2) == 'MD') {
                var val = parseInt(data.raw.substr(2));
                if (val == 6 || val == 9) {
                    // Disable EQ when we're in data mode, since it cannot be
                    // adjusted
                    this.$el.css({'opacity': '0.3', 'pointer-events': 'none'});
                } else {
                    this.$el.css({'opacity': '1', 'pointer-events': ''});
                }
            } else if (this.refreshing) {
                if (data.raw.substr(0,7) == "DBRX EQ" ||
                    data.raw.substr(0,7) == "DBTX EQ" ) {
                    linkManager.sendCommand("SWT"+this.bandCommands[this.band++]+";DB;");
                } else if (data.raw.substr(0,2) == 'DB') {
                    // console.log(data);
                    var band = data.raw.substr(3,4);
                    var val = parseInt(data.raw.substr(7));
                    // console.log("Band " + band + " is " + val);
                    var sliderIndex = this.bandValues.indexOf(band)+1;
                    if (sliderIndex > -1) {
                        $(".eq-" + sliderIndex, this.el).slider('setValue',val);
                    }
                    if (this.band < 9) {
                        linkManager.sendCommand("SWT"+this.bandCommands[this.band++]+";DB;");
                    } else {
                        linkManager.sendCommand('MN255;'); // Exit menu
                        this.refreshing = false;
                        this.band = 0;
                        this.trigger('initialized');
                    }
                }
            }
        },

    });


});