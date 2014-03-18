/**
 *  Settings returns an intrument settings view. These are displayed
 * on top of standard instrument settings in the instrument details view.
 *  
 */


define(function(require) {
    "use strict";
    
    var Backbone = require('backbone');
    
    return Backbone.View.extend({
            initialize:function () {
                // Metadata is a simple object looking like this:
                // {  'address': 'name', 'address2': 'name2', etc... }
                this.mappings = this.model.get('metadata');
                if (this.mappings == null) {
                    this.mappings = {};
                    this.model.set('metadata', this.mappings);
                }
                this.render();
            },

            render:function () {
                $(this.el).html(this.template({mappings: this.mappings}));
                return this;
            },
    
            events: {
                "change" : "change"
            },
    
            change: function(event) {
                console.log("W433 bespoke settings change");

                // Apply the change to the metadata
                var target = event.target;        
                this.mappings[target.name] = target.value;
                this.model.set('metadata',this.mappings);

                // This view is embedded into another view, so change events
                // are going to bubble up to the upper view and change attributes
                // with the same name, so we stop event propagation here:
                event.stopPropagation();

            },
    });
});
