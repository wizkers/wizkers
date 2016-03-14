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

/**
 * Render a controller for the Elecraft KXPA100
 * @author Edouard Lafargue, ed@lafargue.name
 */
define(function(require) {
    "use strict";
    
    var $       = require('jquery'),
        _       = require('underscore'),
        Backbone = require('backbone'),
        Snap = require('snap'),
        simpleplot = require('app/lib/flotplot'),
        template = require('js/tpl/instruments/elecraft/KXPA100.js');
        
 return Backbone.View.extend({

        tagName: "div",
    
        initialize: function (options) {
            
        this.KXPAPoller = null;
        this.currentCR = 0;
        this.currentLR = 0;
        this.currentInputPower = 0;
        this.currentOutputPower = 0;
            
        this.palette = ["#e27c48", "#5a3037", "#f1ca4f", "#acbe80", "#77b1a7", "#858485", "#d9c7ad"];

        // We will pass this when we create plots, this is the global
        // config for the look and feel of the plot
        this.plotoptions = {
            points: 150, // 2.5 minutes @ 1 Hz
            log: false,
            vertical_stretch_parent: true,
            plot_options: {
                xaxes: [{
                        mode: "time",
                        show: true,
                        timeformat: "%M:%S",
                        ticks: 5,
                        timezone: settings.get("timezone")
                    },
                    ],
                yaxis: {
                    min: 0
                },
                grid: {
                    hoverable: true,
                    clickable: true
                },
                legend: {
                    position: "ne"
                },
                colors: this.palette,
            }
        };
        
        linkManager.on('input', this.handleKXAInput, this);

        },
     
        events: {
            'click input[id*="kxpa-cap"]': 'cap_click',
            'click input[id*="kxpa-ind"]': 'ind_click',
            'click input[id="kxpa-pa-attenuator"]': 'at_click',
            'click input[id="kxpa-atu-bypass"]': 'atub_click',
            'click input[id="kxpa-caps-tx"]': 'capstx_click',
            'click input[id="kxpa-pa-bypass"]': 'pabypass_click',
            'change #kxpa-antenna': 'change_ant',
            'change #kxpa-mode': 'change_mode',
        },

        render: function () {
            this.$el.html(template());
            
            var s = Snap("#kxpa100-front");
            Snap.load('js/app/instruments/elecraft/KXPA100-Front-Path.svg', function (f) {
                s.add(f);
                // Set display constraints for the radio panel:
                s.attr({
                    width: "100%",
                });
                //$("#kx3").height($("#kx3").width() * 0.42);
            });
            
            this.addPlot();
            
            return this;
        },
    
        refresh: function() {
        },
        
        shown: function( sh) {
            if (sh) {
                // First of all, we need to ask all the graphs to resize to occupy
                // all their parent divs:
                this.tempplot.plot.resize();
                this.amppowerplot.plot.resize();
                this.voltplot.plot.resize();
                this.swrplot.plot.resize();
                linkManager.sendCommand('^CR;^LR;');
                linkManager.sendCommand('^AT;^AN;');
                linkManager.sendCommand('^BY;^MD;');
                linkManager.sendCommand('^OP;^SI;');
                this.KXPAPoller = setInterval(this.queryKXPA.bind(this), 500);
            } else {
                clearInterval(this.KXPAPoller);
            }
        },
        
        onClose: function() {
            linkManager.off('input', this.handleKXAInput, this);
            // Remove the window resize bindings on our plots:
            this.tempplot.onClose();
            this.amppowerplot.onClose();
            this.voltplot.onClose();
            this.swrplot.onClose();
            clearInterval(this.KXPAPoller);
        },
        
        addPlot: function () {
            // Now initialize the plot areas:
            this.tempplot = new simpleplot({
                model: this.model,
                settings: this.plotoptions
            });
            if (this.tempplot != null) {
                $('.amptempchart', this.el).append(this.tempplot.el);
                this.tempplot.render();
            }
            this.amppowerplot = new simpleplot({
                model: this.model,
                settings: this.plotoptions
            });
            if (this.amppowerplot != null) {
                $('.amppowerchart', this.el).append(this.amppowerplot.el);
                this.amppowerplot.render();
            }
            this.voltplot = new simpleplot({
                model: this.model,
                settings: this.plotoptions
            });
            if (this.voltplot != null) {
                $('.ampvoltagechart', this.el).append(this.voltplot.el);
                this.voltplot.render();
            }
            this.swrplot = new simpleplot({
                model: this.model,
                settings: this.plotoptions
            });
            if (this.swrplot != null) {
                $('.ampswrchart', this.el).append(this.swrplot.el);
                this.swrplot.render();
            }
        },
        
        cap_click: function (e) {
            var val = parseInt(e.target.id.substr(e.target.id.lastIndexOf('-') + 1));
            var caps = [10, 22, 40, 82, 150, 300, 660, 1360];
            var cr = this.currentCR;
            if (e.target.checked) {
                cr = cr | 1 << (caps.indexOf(val));
            } else {
                cr = cr & ~(1 << caps.indexOf(val));
            }
            this.currentCR = cr;
            cr = cr.toString(16);
            if (cr.length < 2) {
                cr = '0' + cr;
            }
            linkManager.sendCommand('^CR' + cr + ';');
            setTimeout(function () {
                linkManager.sendCommand('^CR;')
            }, 50);
        },

        ind_click: function (e) {
            var val = parseInt(e.target.id.substr(e.target.id.lastIndexOf('-') + 1));
            var inds = [50, 110, 230, 480, 1000, 2100, 4400, 9000];
            var lr = this.currentLR;
            if (e.target.checked) {
                lr = lr | 1 << (inds.indexOf(val));
            } else {
                lr = lr & ~(1 << inds.indexOf(val));
            }
            this.currentLR = lr;
            lr = lr.toString(16);
            if (lr.length < 2) {
                lr = '0' + lr;
            }
            linkManager.sendCommand('^LR' + lr + ';');
            setTimeout(function () {
                linkManager.sendCommand('^LR;')
            }, 50);
        },

        at_click: function (e) {
            if (e.target.checked) {
                linkManager.sendCommand('^AT1;');
            } else {
                linkManager.sendCommand('^AT0;');
            }
            setTimeout(function () {
                linkManager.sendCommand('^AT;')
            }, 50);
        },

        capstx_click: function (e) {
            if (e.target.checked) {
                linkManager.sendCommand('^SIT;');
            } else {
                linkManager.sendCommand('^SIA;');
            }
            setTimeout(function () {
                linkManager.sendCommand('^SI;')
            }, 50);
        },

        change_ant: function (e) {
            if ($(e.target).val() == "ant2") {
                linkManager.sendCommand('^AN2;');
            } else {
                linkManager.sendCommand('^AN1;');
            }
            setTimeout(function () {
                linkManager.sendCommand('^AN;')
            }, 100);
        },

        atub_click: function (e) {
            if (e.target.checked) {
                linkManager.sendCommand('^BYB;');
            } else {
                linkManager.sendCommand('^BYN;');
            }
            setTimeout(function () {
                linkManager.sendCommand('^BY;^CR;^LR;')
            }, 50);
        },

        pabypass_click: function (e) {
            if (e.target.checked) {
                linkManager.sendCommand('^OP0;');
            } else {
                linkManager.sendCommand('^OP1;');
            }
            // We query OP status in the regular calls
        },

        change_mode: function (e) {
            var md = $(e.target).val().substr(-1);
            linkManager.sendCommand('^MD' + md + ';');
            setTimeout(function () {
                linkManager.sendCommand('^MD;^BY;^CR;^LR;')
            }, 50);
        },
        
        // Called every second when the KXPA100 tab is shown
        queryKXPA: function () {
            // Split in several smaller strings, otherwise the KX3 and Wizkers
            // compete for KXPA100 access. The best way would be to only send the next command when
            // response to the previous is received.
            linkManager.sendCommand('^PI;^PF;^OP;');
            linkManager.sendCommand('^PV;^TM;^SW;');
            linkManager.sendCommand('^PC;^SV;^F;^BN;');
        },
        
        updatePowerLED: function(power) {
            var ledOn = "#20ff00";
            var ledDim = "#00aa2a";
            var ledOff = "#4e6e56";
            var pl = [ 25, 50, 60, 70, 80,90, 100, 110];
            for (var l = 0; l < pl.length; l++) {
                var col = ledOff;
                if (power >= pl[l]) {
                    col = ledOn;
                } else if (l > 0 && power > pl[l-1]) {
                    col = ledDim;
                } else if (l == 0 && power > 0) {
                    col = ledDim;
                }
                $("#kxpa100-front #power_" + pl[l]).css('fill', col);
            }
        },

        updateSWRLED: function(swr) {
            var ledOn = "#20ff00";
            var ledDim = "#00aa2a";
            var ledOff = "#4e6e56";
            swr = swr * 10;
            var pl = [ 10, 12, 15, 20, 30];
            for (var l = 0; l < pl.length; l++) {
                var col = ledOff;
                if (swr >= pl[l]) {
                    col = ledOn;
                } else if (l > 0 && swr > pl[l-1]) {
                    col = ledDim;
                } else if (l == 0 && swr > 0) {
                    col = ledDim;
                }
                $("#kxpa100-front #swr_" + pl[l]).css('fill', col);
            }
        },

        // All the UI updates related to KXPA100
        handleKXAInput: function (data) {
            
            if (data.charAt(0) != '^')
                return;
                
            // Note: need to match the SVG def for LED off color
            var ledOn = "#20ff00";
            var ledOff = "#4e6e56";
            var cmd = data.substr(1, 2);
            var val = parseInt(data.substr(3)) / 10;
            var stamp = new Date().getTime();
            // If we are getting input, then the amp is on...
            $("#kxpa100-front #led_on").css('fill', ledOn);
            if (cmd == "PI") {
                $("#kxpa-inputpower").html(val);
                this.amppowerplot.appendPoint({
                    'name': "In",
                    'value': val
                });
                this.currentInputPower = val;
            } else if (cmd == "PF") {
                $("#kxpa-forwardpower").html(val);
                this.amppowerplot.appendPoint({
                    'name': "Fwd",
                    'value': val
                });
                this.updatePowerLED(val);
                this.currentOutputPower = val;
            } else if (cmd == "PV") {
                $("#kxpa-reflectedpower").html(val);
                this.amppowerplot.appendPoint({
                    'name': "Rev",
                    'value': val
                });
            } else if (cmd == "TM") {
                $("#kxpa-temperature").html(val);
                this.tempplot.appendPoint({
                    'name': "PA.X",
                    'value': val
                });
            } else if (cmd == "PC") {
                $("#kxpa-inputcurrent").html(val);
                this.voltplot.appendPoint({
                    'name': "A",
                    'value': val
                });
            } else if (cmd == "SV") {
                var val = Math.floor(val) / 100;
                $("#kxpa-inputvoltage").html(val);
                this.voltplot.appendPoint({
                    'name': "V",
                    'value': val
                });
            } else if (cmd == 'SN') {
                $("#kxpa-sn", this.el).html(data.substr(3));
            } else if (cmd == 'RV') {
                $("#kxpa-fwrv", this.el).html(data.substr(3));
            } else if (cmd == 'BN') {
                $("#kxpa-band", this.el).html(data.substr(3));
            } else if (cmd == 'SW') {
                $("#kxpa-lastswr", this.el).html(val);
                this.swrplot.appendPoint({
                    'name': "SWR",
                    'value': val
                });
                if (this.currentOutputPower > 0) {
                    this.updateSWRLED(val);
                } else {
                    this.updateSWRLED(0);
                }
            } else if (data.charAt(1) == 'F') {
                $("#kxpa-frequency", this.el).html(data.substr(2));
            } else if (cmd == 'CR') {
                var val = parseInt(data.substr(3), 16);
                this.currentCR = val;
                var sum = 0;
                var caps = [10, 22, 40, 82, 150, 300, 660, 1360];
                for (var i = 0; i < 8; i++) {
                    if (val & (1 << i)) {
                        $('#kxpa-cap-' + caps[i], this.el).prop('checked', true);
                        sum += caps[i];
                    } else {
                        $('#kxpa-cap-' + caps[i], this.el).prop('checked', false);
                    }
                }
                $('#kxpa-cap', this.el).html(sum);
            } else if (cmd == 'LR') {
                var val = parseInt(data.substr(3), 16);
                this.currentLR = val;
                var sum = 0;
                var inds = [50, 110, 230, 480, 1000, 2100, 4400, 9000];
                for (var i = 0; i < 8; i++) {
                    if (val & (1 << i)) {
                        $('#kxpa-ind-' + inds[i], this.el).prop('checked', true);
                        sum += inds[i];
                    } else {
                        $('#kxpa-ind-' + inds[i], this.el).prop('checked', false);
                    }
                }
                $('#kxpa-ind', this.el).html(sum);
            } else if (cmd == 'AT') {
                var att_on = (data.substr(-1, 1) == "1");
                $('#kxpa-pa-attenuator', this.el).prop('checked', att_on);
                $("#kxpa100-front #led_att").css('fill', att_on ? ledOn : ledOff);
            } else if (cmd == 'AN') {
                var ant = parseInt(data.substr(-1, 1));
                $('#kxpa-antenna', this.el).val('ant' + ant);
                $("#kxpa100-front #ant_" + ant).css('fill', ledOn);
                $("#kxpa100-front #ant_" + (3-ant)).css('fill', ledOff);
            } else if (cmd == 'BY') {
                $('#kxpa-atu-bypass', this.el).prop('checked', (data.substr(-1, 1) == "B"));
            } else if (cmd == 'MD') {
                var md = data.substr(-1, 1);
                $('#kxpa-mode', this.el).val('kxpa-mode-' + md);
                $("#kxpa100-front #led_auto").css('fill', ledOff);
                $("#kxpa100-front #led_byp").css('fill', ledOff);
                $("#kxpa100-front #led_man").css('fill', ledOff);
                switch (md) {
                 case 'A':
                     $("#kxpa100-front #led_auto").css('fill', ledOn);
                 break;
                 case 'M':
                     $("#kxpa100-front #led_man").css('fill', ledOn);
                 break;
                 case 'B':
                     $("#kxpa100-front #led_byp").css('fill', ledOn);
                 break; 
                }
                
            } else if (cmd == 'SI') {
                $('#kxpa-caps-tx', this.el).prop('checked', (data.substr(-1, 1) == "T"));
            } else if (cmd == 'OP') {
                $('#kxpa-pa-bypass', this.el).prop('checked', (data.substr(-1, 1) == "0"));
            }

        },




     

    });

  
});