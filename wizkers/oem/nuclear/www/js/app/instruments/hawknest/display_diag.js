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
 * Diag and settings screen for the instrument
 *
 * @author Edouard Lafargue, ed@lafargue.name
 *
 */

define(function (require) {
    "use strict";

    var $ = require('jquery'),
        _ = require('underscore'),
        Backbone = require('backbone'),
        template = require('js/tpl/instruments/hawknest/HawkNestDiagView.js');

    return Backbone.View.extend({

        initialize: function () {
            this.ins = undefined;

            linkManager.on('input', this.showInput, this);

            if (!linkManager.isRecording())
                linkManager.stopLiveStream();
        },

        events: {
            'click .probeline': 'selectProbe',
            'click #setprobename': 'updateProbeName',
            'click .refresh': 'render'
        },

        onClose: function () {
            console.log('[Hawk Nest] Diag view closing...');
            linkManager.off('input', this.showInput);
        },

        render: function () {
            var self = this;

            // This view touches the instrument object, which can also be modified on the backend, when
            // a new probe is detected - then backend then adds the Probe ID to the metadata.
            // For this reason, we need to refresh our instrument from the backend whenever we display this
            // screen.
            // Worst case, a new probe will be detected while we are on the screen, and its ID will be
            // deleted when we save any changes here. The ID will be added again next time the probe sends
            // data.
            instrumentManager.getInstrument().fetch({
                success: function () {
                    self.ins = instrumentManager.getInstrument();
                    self.$el.html(template(_.extend(self.model.toJSON(), {
                        metadata: self.ins.get('metadata')
                    })));
                }
            });

            return this;
        },

        selectProbe: function (e) {
            var probeid = $(e.target).data('probeid');
            $("#probetitle", this.el).html(probeid);

            // Populate the name of the probe:
            var pid = this.ins.get('metadata').probes[probeid]
            $('#probename', this.el).val(pid.name);
            var ls = ((new Date().getTime()-pid.ts)/60000).toFixed(0);
            $('#lastseen',this.el).html(ls + ' minute' + ((ls == '1') ? '':'s') +' ago');
            $('#lastseenfull', this.el).html(new Date(pid.ts).toISOString());
            $('#voltage', this.el).html(pid.voltage/100 + 'V');
            $('#voltage_solar', this.el).html((pid.solarbattvoltage * 0.0171).toFixed(2) + 'V');
            $('#temp', this.el).html(pid.temp + '&deg;C');
        },
        
        updateProbeName: function(e) {
            var pname = $('#probename', this.el).val();
            var probeid = parseInt($('#probetitle',this.el).html());
            if (isNaN(probeid))
                return;
            var pid = this.ins.get('metadata');
            pid.probes[probeid].name = pname;
            this.ins.set('metadata', pid);
            this.ins.save(null,function() {});
        },

        showInput: function (data) {}
    });
});