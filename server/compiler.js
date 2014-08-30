var fs = require("fs" );
var _ = require("underscore")._;
var _s = require('underscore.string');


var compileTemplate = function(templates) {

    for (var templ in templates) {
        try {
            console.log("Compiling: " + templates[templ]);
            var data = fs.readFileSync("./www/js/tpl/" + templates[templ] + ".html", 'utf8');
            //var uTpl =  templates[templ] + ".prototype.template = ";
            var uTpl = "define(function(require) { ";
            //precompile template
            uTpl +=  "return " + _.template(data).source + ";";
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
                 'OutputDetailsFieldTable', 'OutputDetailsMappingTable',
                 'outputs/SafecastSettingsView', 'outputs/RestSettingsView',
                 'instruments/AudioWaterfall',
                 'instruments/W433LiveView', 'instruments/W433SettingsView', 'instruments/W433LogView', 'instruments/W433NumView',
                 'instruments/ElecraftDiagView', 'instruments/ElecraftFrequencyItemView', 'instruments/ElecraftLiveView', 'instruments/ElecraftNumView',
                 'instruments/FCOledLiveView', 'instruments/FCOledLogView', 'instruments/FCOledNumView',
                 'instruments/Fluke289DiagView', 'instruments/Fluke289LiveView', 'instruments/Fluke289LogManagementView', 'instruments/Fluke289LogView', 'instruments/Fluke289NumView',
                 'instruments/OnyxDiagView', 'instruments/OnyxLiveView', 'instruments/OnyxLogEditView', 'instruments/OnyxLogManagementView', 'instruments/OnyxLogView', 'instruments/OnyxNumView'
                ]);
