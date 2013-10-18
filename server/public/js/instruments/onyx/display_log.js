// Log view for the Onyx.
// 
// Our model is a collection of Logs

window.OnyxLogView = Backbone.View.extend({

    initialize:function () {
        var self = this;
        
        // Need this to make sure "render" will always be bound to our context.
        _.bindAll(this,"render");
        this.deviceLogs = this.collection;
        this.selectedLogIDs = [this.deviceLogs.at(0).id];
        this.onyxlog = null;
        if (this.deviceLogs.length > 0) {
            // And select the default logging session:
            this.onyxlog = this.deviceLogs.at(0).entries;
            this.onyxlog.fetch({success:function() {
                self.render();
            }});
        }
            
        // TODO: save color palette in settings ?
        // My own nice color palette:
        this.palette = ["#e27c48", "#5a3037", "#f1ca4f", "#acbe80", "#77b1a7", "#858485", "#d9c7ad" ],

            
        this.plotOptions = {
            xaxis: { mode: "time", show:true,
                    timezone: settings.get("timezone"),                  
                   },
            grid: {
				hoverable: true,
				clickable: true
			},
            legend: { position: "ne" },
            selection: {
				mode: "xy"
			},
            
            colors: this.palette,
        };        
        
        this.overviewOptions = {
			legend: { show: false },
			xaxis: { mode: "time", show:false, ticks:4 },
			yaxis: { ticks:4 },
			selection: { mode: "xy" },
            colors: this.palette,
		};  
        
    },
    
    events: {
        "click .resetZoom": "resetZoom",
        "click #cpmscale": "cpmScaleToggle",
        "change #currentDevice": "deviceDropdownSelected",
        "change #currentLog": "logDropdownSelected",
        "change .logcheckbox": "refreshLogList",
    },
    
    refreshLogList: function() {
        var self=this;
        var list = $('.logcheckbox',this.el);
        // Create a list of all checked entry IDs
        var entries=[];
        _.each(list, function(entry) {
            if (entry.checked)
                entries.push(entry.value);
        });

        this.selectedLogIDs = entries;
        var selectedLogs = this.deviceLogs.filter(function(log) {
            return (self.selectedLogIDs.indexOf(log.id) > -1);
        });
        // Now trigger a rendering
        var renderGraph = _.after(selectedLogs.length, this.render);
        _.each(selectedLogs,function(log) {
            log.entries.fetch({success: renderGraph});
        });        
    },
        
    deviceDropdownSelected: function(event) {
        var target = event.target;
        this.selectDevice(target.value);
    },
    
    selectDevice: function(newGuid) {
        this.currentDevice = this.collection.where({guid: newGuid})[0];
        this.deviceLogs = this.allDeviceLogs.byGUID(this.currentDevice.get('guid'));
        this.render();
    },
    
    logDropdownSelected: function(event) {
        var target = event.target;
        this.selectLog(target.value);
    },
    
    selectLog: function (logSessionID) {
        this.onyxlog = this.allLogEntries.byLogSession(logSessionID);
        this.render();
    },
    
    resetZoom: function() {
        delete this.ranges;
        this.addPlot();
        return false;
    },

    cpmScaleToggle: function(event) {
        var change = {};
        if (event.target.checked) {
            change["cpmscale"]="log";
        } else {
            change["cpmscale"]="linear";
        }
        settings.set(change);
        this.render();
        this.addPlot();
        
    },

    
    render:function () {
        var self = this;
        console.log('Main render of Log management view');
        var selectedStuff = { device: null, sessions: null };

        selectedStuff.sessions = this.selectedLogIDs;
        $(this.el).html(this.template({devices: this.collection.toJSON(), deviceLogs: this.deviceLogs.toJSON(), selected: selectedStuff}));
        if (settings.get("cpmscale") == "log")
            $("#cpmscale",this.el).attr("checked",true);
        if (settings.get('cpmscale')=="log") {
            this.plotOptions.yaxis = {
                        min:1,
                        //ticks: [1,10,30,50,100,500,1000,1500],
                        transform: function (v) { return Math.log(v+10); },
                        inverseTransform: function (v) { return Math.exp(v)-10;}
                    };
            this.overviewOptions.yaxis = this.plotOptions.yaxis;
        } else if ('yaxis' in this.plotOptions){
            delete this.plotOptions.yaxis.min;
            delete this.plotOptions.yaxis.transform;
            delete this.plotOptions.yaxis.inverseTransform;
        }
            
        this.addPlot();

        return this;
    },
    
    onClose: function() {
        console.log("Log management view closing...");
        
        // Restore the settings since we don't want them to be saved when changed from
        // the home screen
        settings.fetch();
    },
        
    // Generate a "blob:"  URL to download (all) the data;
    saveDataUrl: function() {
        var json = "";
        for (var i=0; i < this.onyxlog.length; i++) {
            json += "{timestamp:" + this.onyxlog.at(i).get('timestamp') +
                    ",cpm:" + this.onyxlog.at(i).get('cpm') + "},";
        }

        var jsonBlob = new Blob([json], {type: 'application/json'});
        var url = window.URL.createObjectURL(jsonBlob);
        $('.ctrl-save', this.el).attr('href', url);
    },
    
    
    // We can only add the plot once the view has finished rendering and its el is
    // attached to the DOM, so this function has to be called from the home view.
    addPlot: function() {
        var self=this;
        
        if (this.onyxlog == null || this.onyxlog.length == 0)
            return;
        
        // TODO: only valid for 1st log, not the whole set
        $('#log_size',this.el).html(this.onyxlog.length);
        $('#log_start',this.el).html(new Date(this.onyxlog.getLogStart()).toString());
        $('#log_end',this.el).html(new Date(this.onyxlog.getLogEnd()).toString());

        
        // Now initialize the plot area:
        console.log('Geiger chart size: ' + this.$('.locochart').width());
        
        // Restore current zoom level if it exists:
        if (this.ranges) {
            this.plot = $.plot($(".locochart",this.el), this.getData(this.ranges.xaxis.from, this.ranges.xaxis.to),
                $.extend(true, {}, this.plotOptions, {
                    xaxis: { min: this.ranges.xaxis.from, max: this.ranges.xaxis.to },
                    yaxis: { min: this.ranges.yaxis.from, max: this.ranges.yaxis.to }
                })
             );

        } else {
            this.plot = $.plot($(".locochart", this.el), this.packData(this.onyxlog), this.plotOptions);
        };
            
        $(".locochart", this.el).bind("plothover", function (event, pos, item) {
            if (item) {
                if (previousPoint != item.dataIndex) {
                    previousPoint = item.dataIndex;

                    $("#tooltip").remove();
                    var x = item.datapoint[0],
                    y = item.datapoint[1];

                    self.showTooltip(item.pageX, item.pageY,
                        "<small>" + ((settings.get('timezone') === 'UTC') ? 
                                        new Date(x).toUTCString() :
                                        new Date(x).toString()) + "</small><br>" + item.series.label + ": <strong>" + y + "</strong>");
                }
            } else {
                $("#tooltip").remove();
                previousPoint = null;            
            }
        });

        // Create the overview chart:
        this.overview = $.plot($("#overview",this.el), this.packData(this.onyxlog), this.overviewOptions);
        
        // Connect overview and main charts
        $(".locochart",this.el).bind("plotselected", function (event, ranges) {

            // clamp the zooming to prevent eternal zoom

            if (ranges.xaxis.to - ranges.xaxis.from < 0.00001) {
                ranges.xaxis.to = ranges.xaxis.from + 0.00001;
            }

            if (ranges.yaxis.to - ranges.yaxis.from < 0.00001) {
                ranges.yaxis.to = ranges.yaxis.from + 0.00001;
            }
            
            // Save the current range so that switching plot scale (log/linear)
            // can preserve the zoom level:
            self.ranges = ranges;

            // do the zooming
            this.plot = $.plot($(".locochart",this.el), self.getData(ranges.xaxis.from, ranges.xaxis.to),
                $.extend(true, {}, self.plotOptions, {
                    xaxis: { min: ranges.xaxis.from, max: ranges.xaxis.to },
                    yaxis: { min: ranges.yaxis.from, max: ranges.yaxis.to }
                })
             );

            // don't fire event on the overview to prevent eternal loop
            self.overview.setSelection(ranges, true);
        });

        $("#overview",this.el).bind("plotselected", function (event, ranges) {
             self.plot.setSelection(ranges);
          });
        
        // Last, update the save data URL to point to the data we just displayed:
        this.saveDataUrl();

    },

    
    // TODO: depending on log type, we need to pack our data differently...
    packData: function(values) {
        var self=this;
        // Create a table of Y values with the x values from our collection
        var data = [];
        // Split by Session ID:
        var logs = this.deviceLogs.filter(function(log) {
            return (self.selectedLogIDs.indexOf(log.id) > -1);
        });
        
        // At this stage we know the logs are already fetched, btw
        for (var j=0; j<logs.length; j++) {
            var ret = [];
            var value = logs[j].entries;
            for (var i=0; i < value.length; i++) {
                var entry = value.at(i);
                ret.push([entry.get('timestamp'), entry.get('data').cpm.value]);
            }
            data.push({ data:ret, label:"CPM"});
        }
        return data;
    },
    
    // Ugly at this stage, just to make it work (from flotcharts.org examples)
    showTooltip: function (x, y, contents) {
			$("<div id='tooltip' class='well'>" + contents + "</div>").css({
				position: "absolute",
				display: "none",
				top: y + 5,
				left: x + 5,
                padding: "3px",
				opacity: 0.90
			}).appendTo("body").fadeIn(200);
    },
    
    getData: function(x1, x2) {
        return this.packData(this.onyxlog.getDateInterval(x1,x2));
    },

    
});