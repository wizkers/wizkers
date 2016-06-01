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
 * Diag and settings screen for the Sark 110
 *
 * @author Edouard Lafargue, ed@lafargue.name
 *
 */

define(function (require) {
    "use strict";

    var $ = require('jquery'),
        _ = require('underscore'),
        Backbone = require('backbone'),
        template = require('js/tpl/instruments/sark110/Sark110DiagView.js');

    return Backbone.View.extend({

        initialize: function () {
            linkManager.on('input', this.showInput, this);

            if (!linkManager.isRecording())
                linkManager.stopLiveStream();
        },

        events: {
            "click .refresh": "refresh",
            "click #cmdsend": "sendcmd",
            "keypress input#manualcmd": "sendcmd",
        },

        onClose: function () {
            console.log("[Sark110] Diag view closing...");
            linkManager.off('input', this.showInput);
        },

        render: function () {
            var self = this;
            this.$el.html(template(this.model.toJSON()));
            this.refresh();
            return this;
        },

        refresh: function () {
            // Query controller for various info:
            this.queriesDone = false;
            if (linkManager.isConnected()) {
                linkManager.driver.version();
            }
        },

        sendcmd: function (event) {
            // We react both to button press & Enter key press
            if ((event.target.id == "manualcmd" && event.keyCode == 13) || (event.target.id != "manualcmd"))
                linkManager.driver.rx($('#manualcmd', this.el).val());
        },


        showInput: function (data) {
            // Blink the indicator to show we're getting data
            $('.comlink', this.el).toggleClass('btn-success');
            var i = $('#input', this.el);
            i.val(i.val() + JSON.stringify(data) + '\n');
            // Autoscroll:
            i.scrollTop(i[0].scrollHeight - i.height());

            if (data.version != undefined) {
                $('#version', this.el).html(data.version);
            }
        }
    });
});