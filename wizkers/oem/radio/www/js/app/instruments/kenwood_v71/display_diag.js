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
 * Kenwood V71 Diagnostics display.
 * @author Edouard Lafargue ed@lafargue.name
 */
define(function (require) {
    "use strict";

    var template = require('js/tpl/instruments/kenwood_v71/DiagView.js');

    // Need to load these, but no related variables.
    require('bootstrap');
    require('bootstrapslider');

    var taking_screenshot = false;
    var pamode_on = false;

    var setLabel = function (selector, el, green) {
        if (green) {
            $(selector, el).addClass("label-success").removeClass("label-default");
        } else {
            $(selector, el).addClass("label-default").removeClass("label-success");
        }
    };

    return Backbone.View.extend({

        initialize: function () {
            // Don't stop the live stream anymore because we use it to monitor
            // the amplifier
            linkManager.stopLiveStream();
            linkManager.on('input', this.showInput, this);
            this.menumode = '';
            this.memSettings = null;

        },

        render: function () {
            var self = this;
            this.$el.html(template());

            require(['app/instruments/kenwood_v71/settings_mems'], function(view) {
               self.memSettings = new view();
               $('#settings-mems', self.el).append(self.memSettings.el);
               self.memSettings.render();
            });

            // Force rendering of first tab, somehow the drawing on the tab does not work
            // very well until I click, otherwise
            $("#settingsTabs a:first", this.el).tab('show');
            linkManager.sendCommand({command: 'get_uid'});
            return this;
        },

        onClose: function () {
            console.log("Kenwood V71 diagnostics view closing...");
            linkManager.off('input', this.showInput, this);
            if (this.memSettings) {
                this.memSettings.onClose();
            }
        },

        events: {
            'click #cmdsend': "sendcmd",
            'keypress input#manualcmd': "sendcmd",
            'click #px3-screenshot': "take_screenshot",
            'click #screenshot': "save_screenshot",
            'shown.bs.tab a[data-toggle="tab"]': "tab_shown",
        },

        tab_shown: function (e) {

            if (e.target.innerText == 'Memories') {
                // this.MemSettings.refresh();
            }
        },


        sendcmd: function (event) {
            // We react both to button press & Enter key press
            if ((event.target.id == "manualcmd" && event.keyCode == 13) || (event.target.id != "manualcmd"))
                linkManager.sendCommand({ command:'raw', arg:this.$('#manualcmd').val()});
        },


        showInput: function (data) {

            if (data.raw != undefined) {
                // Update our raw data monitor
                var i = $('#input', this.el);
                var scroll = (i.val() + data.raw + '\n').split('\n');
                // Keep max 50 lines:
                if (scroll.length > 50) {
                    scroll = scroll.slice(scroll.length - 50);
                }
                i.val(scroll.join('\n'));
                // Autoscroll:
                i.scrollTop(i[0].scrollHeight - i.height());
            }

            if (data.uid != undefined) {
                this.$('#radio-sn').html(data.uid);
            }
        }
    });
});