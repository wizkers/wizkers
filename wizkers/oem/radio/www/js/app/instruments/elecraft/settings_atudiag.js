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
 * KX2/KX3 ATU diags
 *
 * @author Edouard Lafargue, ed@lafargue.name
 *
 */

define(function(require) {
    "use strict";

    var template = require('js/tpl/instruments/elecraft/SettingsATUDiag.js');

    return Backbone.View.extend({

        initialize:function () {
            linkManager.on('input', this.showInput, this);
            this.iskx3 = instrumentManager.getInstrument().get('type') == 'elecraft';
        },

        events: {
            'change #atu-mode': 'change_mode',
        },

        onClose: function() {
            linkManager.off('input', this.showInput);
        },

        render:function () {
            var self = this;
            this.$el.html(template());
            return this;
        },

        refresh: function() {
            this.refreshing = true;
            this.changing_mode = true;
            linkManager.sendCommand('MN023;MP;MN255;');
            // this.$el.css({'opacity': '1', 'pointer-events': ''});
        },

        change_mode: function (e) {
            var md = $(e.target).val().substr(-3);
            this.changing_mode = true;
            linkManager.sendCommand('MN023;MP' + md + ';MN255;AK;');
        },

        showInput: function(data) {
            if (!this.$el.is(':visible')) {
                return;
            }
            var cmd = data.raw.substr(0, 2);
            var val = data.raw.substr(2);

            if (cmd == 'DS') {
                var aa = parseInt(val.substr(1,2), 16);
                var bb = parseInt(val.substr(4,2), 16);
                var cc = val[7];
                console.log(aa,bb,cc);

                this.$('#atu' + this.atu_set + '-caps-tx').prop('checked', (cc != 'A'));
                //this.$('#atu-bypass').prop('checked', (cc == 0 && bb == 0 && aa == 0));

                // Get inductors
                var sum = 0;
                var inds = [60, 120, 250, 500, 1000, 2000, 4000, 8000];
                for (var i = 0; i < 8; i++) {
                    if (aa & (1 << i)) {
                        this.$('#atu' + this.atu_set + '-ind-' + inds[i]).prop('checked', true);
                        sum += inds[i];
                    } else {
                        this.$('#atu' + this.atu_set + '-ind-' + inds[i]).prop('checked', false);
                    }
                }
                this.$('#atu' + this.atu_set + '-ind').html(sum);

                sum = 0;
                var caps = [10, 18, 39, 82, 164, 330, 680, 1360];
                for (var i = 0; i < 8; i++) {
                    if (bb & (1 << i)) {
                        this.$('#atu' + this.atu_set + '-cap-' + caps[i]).prop('checked', true);
                        sum += inds[i];
                    } else {
                        this.$('#atu' + this.atu_set + '-cap-' + caps[i]).prop('checked', false);
                    }
                }
                this.$('#atu' + this.atu_set + '-cap').html(sum);

                if (this.refreshing) {
                    this.refreshing = false;
                    this.atu_set = (this.atu_set == 1) ? 2 : 1;
                    console.debug('Getting ATU settings for set', this.atu_set);
                    linkManager.sendCommand('MN112;UP;SWT' + ( this.iskx3 ? 44: 20 ) + ';DS;');
                } else {
                    // This effectively restores the initial ATU set
                    linkManager.sendCommand('UP;MN255;');
                }
            } else if (cmd == 'MP') {
                if (this.changing_mode) {
                    this.$('#atu-mode').val('atu-mode-' + val);
                    this.changing_mode = false;
                    if (this.refreshing) {
                        console.debug('Getting what ATU set is active');
                        linkManager.sendCommand('MN112;MP;');
                    }
                } else {
                    // If not changing mode, we're reading the setting
                    // for menu 112:
                    this.atu_set = (val == "000") ? 1 : 2;
                    console.debug('ATU set active:', this.atu_set);
                    linkManager.sendCommand('MN112;SWT' + ( this.iskx3 ? 44: 20 ) + ';DS;');
                }
            }
        }
    });
});