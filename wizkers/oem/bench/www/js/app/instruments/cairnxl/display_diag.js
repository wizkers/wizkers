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
 *  Diagnostics display. Work in progress
 * @author Edouard Lafargue ed@lafargue.name
 */
define(function (require) {
    "use strict";

    var template = require('js/tpl/instruments/cairnxl/DiagView.js');

    return Backbone.View.extend({

        initialize: function () {
            // Don't stop the live stream anymore because we use it
        },

        render: function () {
            var self = this;
            this.$el.html(template());
            return this;
        },

        onClose: function () {
            console.log("Cairn XL diagnostics view closing...");
            linkManager.off('input', this.showInput, this);
        },

        events: {
            "click #cmd-raw-send": "raw_send",
        },

        raw_send: function() {
            var cmd = this.$("#cmd-raw-input").val();
            linkManager.sendCommand({command:'raw', arg: cmd});

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
        }
    });
});