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

/*
 * Live view for the KXPA100 amplifier as standalone instrument
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
        template = require('js/tpl/instruments/elecraft/KXPA100-standalone.js');

    return Backbone.View.extend({

        initialize: function (options) {
            this.deviceinitdone = false;
            linkManager.on('status', this.updateStatus, this);
        },

        render: function () {
            var self = this;
            console.log('Main render of KXPA100 Standalone main view');
            this.$el.html(template());
            
            require(['app/instruments/elecraft/display_kxpa100'], function(view) {
               self.KXPA100 = new view();
               $('#kxpa100', self.el).append(self.KXPA100.el);
               self.KXPA100.render(); 
            });
            
            return this;
        },
        
        onClose: function () {
            this.KXPA100.onClose();
            linkManager.off('status', this.updatestatus, this);            
        },
        
        updateStatus: function (data) {
            if (data.portopen && !this.deviceinitdone) {
                this.KXPA100.shown(true);
                this.deviceinitdone = true;

                linkManager.driver.getRequestedPower();
            } else if (!data.portopen) {
                this.deviceinitdone = false;
                this.KXPA100.shown(false);
            }
        },

        
    });
});