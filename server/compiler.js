/** (c) 2015 Edouard Lafargue, ed@lafargue.name
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

var fs = require("fs");
var _ = require("underscore")._;
var _s = require('underscore.string');


var compileTemplate = function (templates) {

    for (var templ in templates) {
        try {
            console.log("Compiling: " + templates[templ]);
            var data = fs.readFileSync("./www/js/tpl/" + templates[templ] + ".html", 'utf8');
            //var uTpl =  templates[templ] + ".prototype.template = ";
            var uTpl = "define(function(require) { ";
            //precompile template
            uTpl += "return " + _.template(data).source + ";";
            uTpl += "});";
            //console.log(uTpl);
        } catch (e) {
            console.error('Could not compile a template for: ' + templates[templ] + " -- " + e.message);
        }

        try {

            fs.writeFileSync("./www/js/tpl/" + templates[templ] + ".js", uTpl);
        } catch (e) {
            console.error('Could not save compile template for: ' + templates[templ] + " -- " + e.message);
        }
    }

}

compileTemplate(['HomeView', 'HeaderView', 'AboutView', 'SettingsView', 'LogManagementView',
                 'InstrumentDetailsView', 'InstrumentListItemView', 'OutputListItemView', 'OutputDetailsView',
                 'OutputDetailsFieldTable', 'OutputDetailsMappingTable', 'instruments/HawkNestLiveView',
                 'outputs/SafecastSettingsView', 'outputs/RestSettingsView', 'outputs/RigctldSettingsView',
                 'instruments/AudioWaterfall', 'instruments/USBGeigerSettingsView', 'instruments/USBGeigerNumView',
                 'instruments/W433LiveView', 'instruments/W433SettingsView', 'instruments/W433LogView', 'instruments/W433NumView',
                 'instruments/ElecraftDiagView', 'instruments/ElecraftFrequencyItemView', 'instruments/ElecraftLiveView',
                 'instruments/ElecraftNumView', 'instruments/ElecraftSettingsView',
                 'instruments/ElecraftEqualizer',
                 'instruments/FCOledLiveView', 'instruments/FCOledLogView', 'instruments/FCOledNumView',
                 'instruments/Fluke289DiagView', 'instruments/Fluke289LiveView', 'instruments/Fluke289LogManagementView',
                 'instruments/Fluke289LogView', 'instruments/Fluke289NumView',
                 'instruments/OnyxDiagView', 'instruments/OnyxLiveView', 'instruments/OnyxLogEditView',
                 'instruments/OnyxLogManagementView', 'instruments/OnyxLogView', 'instruments/OnyxNumView',
                 'instruments/USBGeigerUpgrader',
                 'connections/serialport', 'connections/helium', 'connections/pinoccio'
                ]);