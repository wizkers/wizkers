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
 * @author Edouard Lafargue, ed@lafargue.name
 */
define(function(require) {
    "use strict";
    
    var $        = require('jquery'),
        _       = require('underscore'),
        Backbone = require('backbone'),
        template = require('tpl/connections/helium');

    return Backbone.View.extend({
        
        initialize: function(options) {
            // Initialize Helium-specific attributes:
            if (this.model.get('helium') == undefined) {
                this.model.set('helium', { mac: '00ff00ff00ff',
                                          token: 'XXXXX==' });
            }
        },

        render:function () {
            $(this.el).html(template(this.model.toJSON()));
            return this;
        }

    });
});