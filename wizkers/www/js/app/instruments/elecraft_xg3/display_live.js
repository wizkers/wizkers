/**
 * (c) 2016 Edouard Lafargue, ed@lafargue.name
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
/*
 * Live view for the XG3 frequency reference
 *
 * Our model is the settings object.
 *
 * @author Edouard Lafargue, ed@lafargue.name
 */

define(function (require) {
    "use strict";

    var $ = require('jquery'),
        _ = require('underscore'),
        Backbone = require('backbone'),
        utils = require('app/utils'),
        Snap = require('snap'),
        template = require('js/tpl/instruments/elecraft_xg3/LiveView.js');

    return Backbone.View.extend({

        initialize: function (options) {
            this.deviceinitdone = false;
            linkManager.on('status', this.updateStatus, this);
        },

        render: function () {
            var self = this;
            console.log('Main render of XG3 main view');
            this.$el.html(template());
            
            var s = Snap("#xg3-front");
            Snap.load('js/app/instruments/elecraft_xg3/XG3-Path.svg', function (f) {
                f.select("#layer1").click(function (e) {
                    self.handleXG3Button(e);
                });
                s.add(f);
                // Set display constraints for the radio panel:
                s.attr({
                    width: "100%",
                });
            });
            return this;
        },
        
        onClose: function () {
            linkManager.off('status', this.updatestatus, this);            
        },
        
        updateStatus: function (data) {
            if (data.portopen && !this.deviceinitdone) {
                // TODO
                this.deviceinitdone = true;

                linkManager.driver.getRequestedPower();
            } else if (!data.portopen) {
                this.deviceinitdone = false;
                // TODO
            }
        },
        
        handleXG3Button: function (e) {
            console.log(e.target.id);
            // var code = this.buttonCodes[e.target.id];
            // if (code != null) {
            //    linkManager.sendCommand('SW' + code + ';');
            // }
        },


        
    });
});