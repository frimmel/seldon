(function ($) {
    "use strict";

    var EventEmitter = window.EventEmitter,
        seldon = {},
        activeBtn = [],
        areasList = [],
        app;

    seldon.App = function () {
        EventEmitter.call(this);
        OpenLayers.Util.onImageLoadErrorColor = 'transparent';
        OpenLayers.IMAGE_RELOAD_ATTEMPTS = 3;
        this.map         = undefined; // OpenLayers map object
        this.tileManager = undefined;
        this.projection  = undefined; // OpenLayers map projection
        this.gisServerType = undefined; //The type of server that the wms layers will be served from
        this.useProxyScript = undefined;
        this.scalebar    = undefined;
        this.zoomInTool  = undefined; // OpenLayers zoom in tool
        this.zoomOutTool = undefined; // OpenLayers zoom out tool
        this.dragPanTool = undefined; // OpenLayers dragpan tool
        this.id_markerLayer = undefined;
        this.maxExtent   = {
            left   : -15000000,  //NOTE: These values get replaced by settings from the config file.
            bottom : 2000000,    //      Don't worry about keeping these in sync if the config fil
            right  : -6000000,   //      changes; these are just here to prevent a crash if we ever
            top    : 7000000     //      read a config file that is missing the <extent> element.
        };
        this.baseLayers            = []; // list of BaseLayer instances holding info about base layers from config file
        this.accordionGroups       = []; // list of AccordionGroup instances holding info about accordion groups from config file
        this.themes                = []; // list of Theme instances holding info about themes from config file
        this.maskParentLayers      = []; // list of currently active global mask parent layers
        this.masks                 = [];
        this.defaultMasks          = ["MaskForForest"];
        this.radioButtonList       = [];
        this.radioButtonLayers     = [];
        this.dropdownBoxList       = [];
        this.dropdownBoxLayers     = [];
        this.currentBaseLayer      = undefined;
        this.currentAccordionGroup = undefined;
        this.currentTheme          = undefined;
        this.identifyTool          = undefined;
        this.multigraphTool        = undefined;

        // array of saved extent objects; each entry is a JavaScript object of the form
        //     { left : VALUE, bottom : VALUE, right : VALUE, top : VALUE }
        this.savedExtents = [];

        // index of the "current" extent in the above array:
        this.currentSavedExtentIndex = -1;

        // save the current extent into the savedExtents array, if it is different from
        // the "current" one.  It is important to only save it if it differs from the
        // current one, because sometimes OpenLayers fires multiple events when the extent
        // changes, causing this function to be called multiple times with the same
        // extent
        this.saveCurrentExtent = function () {
            var newExtent,
                currentSavedExtent,
                newSavedExtents,
                i;

            newExtent = (function (extent) {
                return { left : extent.left, bottom : extent.bottom, right : extent.right, top : extent.top };
            }(this.map.getExtent()));

            if (this.currentSavedExtentIndex >= 0) {
                currentSavedExtent = this.savedExtents[this.currentSavedExtentIndex];
                if (extentsAreEqual(currentSavedExtent, newExtent)) {
                    return;
                }
            }

            // chop off the list after the current position
            newSavedExtents = [];
            for (i = 0; i <= this.currentSavedExtentIndex; ++i) {
                newSavedExtents.push(this.savedExtents[i]);
            }
            this.savedExtents = newSavedExtents;

            // append current extent to the list
            this.savedExtents.push(newExtent);
            ++this.currentSavedExtentIndex;
        };

        this.zoomToExtent = function (extent, save) {
            if (save === undefined) {
                save = true;
            }
            var bounds = new OpenLayers.Bounds(extent.left, extent.bottom, extent.right, extent.top);
            this.map.zoomToExtent(bounds, true);
            if (save) {
                this.saveCurrentExtent();
            }
            //$('#extentOutput').empty().append($(this.printSavedExtents()));
        };

        this.zoomToPreviousExtent = function () {
            if (this.currentSavedExtentIndex > 0) {
                --this.currentSavedExtentIndex;
                this.zoomToExtent(this.savedExtents[this.currentSavedExtentIndex], false);
            }
        };

        this.checkForExistingItemInArray = function (arr,item) {
            var isItemInArray = false;
            for (var i = 0; i < arr.length; i++) {
                if (arr[i]=item) {
                    isItemInArray = true;
                }
            }
            return isItemInArray;
        };

        this.zoomToNextExtent = function () {
            if (this.currentSavedExtentIndex < this.savedExtents.length-1) {
                ++this.currentSavedExtentIndex;
                this.zoomToExtent(this.savedExtents[this.currentSavedExtentIndex], false);
            }
        };

        this.printSavedExtents = function () {
            // This function is for debugging only and is not normally used.  It returns an HTML
            // table showing the current savedExtents list, and the current position within the list.
            var html = "<table>";
            var len = this.savedExtents.length;
            var i, e;
            for (i = len-1; i >= 0; --i) {
                e = this.savedExtents[i];
                html += Mustache.render('<tr><td>{{{marker}}}</td><td>{{{number}}}</td>'
                                        + '<td>left:{{{left}}}, bottom:{{{bottom}}}, right:{{{right}}}, top:{{{top}}}</td></tr>',
                                        {
                                            marker : (i === this.currentSavedExtentIndex) ? "==&gt;" : "",
                                            number : i,
                                            left : e.left,
                                            bottom : e.bottom,
                                            right : e.right,
                                            top : e.top
                                        });
            }
            html += "</table>";
            return html;
        };

        this.setBaseLayer = function (baseLayer) {
            var app = this;
            if (baseLayer.name.indexOf("Google") > -1) {
                var layer = new OpenLayers.Layer.Google("Google Streets");
                app.map.removeLayer(app.map.layers[0]);
                app.currentBaseLayer = baseLayer;
                app.map.addLayers([layer]);
                app.map.setLayerIndex(layer, 0);
                app.emit("baselayerchange");
            } else { //assuming esri base layer at this point
                $.ajax({
                    url: baseLayer.url + '?f=json&pretty=true',
                    dataType: "jsonp",
                    success:  function (layerInfo) {
                        var layer = new OpenLayers.Layer.ArcGISCache("AGSCache", baseLayer.url, {
                            layerInfo: layerInfo
                        });
                        app.map.removeLayer(app.map.layers[0]);
                        app.currentBaseLayer = baseLayer;
                        app.map.addLayers([layer]);
                        app.map.setLayerIndex(layer, 0);
                        app.emit("baselayerchange");
                    },
                    error: function(jqXHR, textStatus, errorThrown) {
                        alert(textStatus);
                    }
                });
            }
        };

        // Begin Accordion Group Specific Functions
        this.setAccordionGroup = function (accordionGroup) {
            this.currentAccordionGroup = accordionGroup;
            this.emit("accordiongroupchange");
        };

        this.clearAccordionSections = function (accordionGroup) {
            $(accordionGroup).empty();
            $(accordionGroup).data('listAccordion').sections = [];
            $(accordionGroup).accordion('refresh');
        };

        this.addAccordionSection = function (accordionGroup, title) {
            var sectionObj = {
                title          : title,
                titleElement   : $('<h3>' + title + '</h3>'),
                contentElement : $('<div></div>'),
                sublists    : []
            };
            $(accordionGroup).data('listAccordion').sections.push(sectionObj);
            $(accordionGroup).append(sectionObj.titleElement)
                .append(sectionObj.contentElement);
            $(accordionGroup).accordion('refresh');
            return sectionObj;
        }

        this.addAccordionSublists = function (g, items) {
            $(g.contentElement).append(items);
        }

        this.addAccordionSublistItems = function (s, items) {
            var contents = $('<div class="layer"></div>');
            contents.append(items);
            var layer = {
                name : name,
                contentElement : contents
            };
            s.items.push(layer);
            s.contentElement.append(layer.contentElement);
        }

        // End Accordion Group Specific Functions

        this.setThemeContinue = function (theme, options, accordionGroup) {
            app.currentTheme = theme;
            app.setAccordionGroup(accordionGroup);
            $('#layerPickerDialog').scrollTop(0);
            $('#mapToolsDialog').scrollTop(0);
            app.emit("themechange");

            //jdm 6/28/13: do a check to see if there is a corresponding active mask in options.shareUrlMasks
            //can be multiple mask per a parent layer
            if (options.shareUrlMasks !== undefined) {
                for (var m = 0; m < options.shareUrlMasks.length; m++) {
                    //we have already activated the respective parent layers
                    //so so we have to go through the masking process
                    //console.log("setMaskByMask at line 239");
                    this.setMaskByMask(true, "MaskFor"+options.shareUrlMasks[m]);
                }
            }

            //if zoom parameter on theme to to that extent
            if (theme.zoom) {
                var zoomExtent = {
                    left : theme.xmin,
                    bottom : theme.ymin,
                    right : theme.xmax,
                    top : theme.ymax };
                app.zoomToExtent(zoomExtent);
            }

            if (!accordionGroup) {
                // if we get to this point and don't have an accordion group to open,
                // default to the first one
                accordionGroup = theme.accordionGroups[0];
            }

            for (var mp = 0; mp < app.maskParentLayers.length; mp++) {
                $('#mask-status'+ app.maskParentLayers[mp].lid).text("(m)");
                $("#chk"+app.maskParentLayers[mp].lid).prop('checked', true);
            }

        } //end setThemeContinue

        this.setTheme = function (theme, options) {
            var app = this,
                $layerPickerAccordion = $("#layerPickerAccordion"),
                flag,
                accordionGroup,
                labelElem,
                brElem,
                textElem,
                maskLabelElem,
                maskTextElem,
                activeMaskLayers = [];

            //jdm 1/3/14: set the default forest mask
            //TODO: There should be a more eloquent way to handle default mask
            if ($.isEmptyObject(options) && (app.masks.length==0)) {
                for (var dm = 0; dm < app.defaultMasks.length; dm++) {
                    //console.log("setMaskByMask at line 247");
                    app.setMaskByMask(true, app.defaultMasks[dm]);
                }
            }

            //jdm (11/1/13): fix for changing themes and accounting for active layers
            //we have changed a theme here, but we need to account for active layers.
            //This accounts for active mask on theme change also.
            if (options === undefined) {
                options = {};
                options.layers = [];
                options.shareUrlMasks = [];
                var shareUrlInfo = ShareUrlInfo.parseUrl(app.shareUrl());
                //get previously active accordion group e.g. accgp=G04
                var gid = shareUrlInfo.accordionGroupGid;
                //get previously active layers e.g. layers=AD,AAB
                var lids = shareUrlInfo.layerLids;
                //loop through the accordion groups the active one accordingly
                for (var a = 0, b = this.accordionGroups.length; a < b; a++) {
                    if (this.accordionGroups[a].gid==gid) {
                        options.accordionGroup = this.accordionGroups[a];
                    }
                }

                //options.layers = lids;
                //loop through the layers active one accordingly
                for (var i = app.map.getNumLayers()-1; i > 0; i--) {
                    var currLayer = app.map.layers[i];
                    for (var j=0; j<lids.length; j++) {
                        if (lids[j] == currLayer.seldonLayer.lid) {
                            options.layers.push(currLayer.seldonLayer);
                        }
                    }
                }
            }

            if ($layerPickerAccordion.length === 0) {
                flag = true;
                $layerPickerAccordion = $(document.createElement("div"))
                    .attr("id", "layerPickerAccordion")
                    .addClass("layerAccordionClass")
                    .css("height", "400px");
            }

            //Clear our previous accordion on theme change
            if ($layerPickerAccordion.data('listAccordion')) {
                // $layerPickerAccordion.listAccordion('clearSections');
                app.clearAccordionSections($layerPickerAccordion);
            }

            //Initialize listAccordion
            $layerPickerAccordion.accordion({
                heightStyle : 'content',
                change      : function (event, ui) {
                    var accordionGroupIndex = $layerPickerAccordion.accordion('option', 'active');
                    app.setAccordionGroup(theme.accordionGroups[accordionGroupIndex]);
                }
            });
            if ( ! $layerPickerAccordion.data('listAccordion') ) {
                $layerPickerAccordion.data('listAccordion', {
                    accordionOptions     : options,
                    sections             : []
                });
                $layerPickerAccordion.accordion('option', 'active');
            }

            //jdm: re-wrote loop using traditional for loops (more vintage-IE friendly)
            //vintage-IE does work with jquery each loops, but seems to be slower
            // for (var a = 0, b = theme.accordionGroups.length; a < b; a++) {
            var a = 0;
            var defaultAccordionGroup = undefined;
            var ro1 = new RepeatingOperation(function () {
                var accGp = theme.accordionGroups[a],
                    accordionGroupOption = options.accordionGroup;
                // Decide whether to open this accordion group.  If we received an
                // `accordionGroup` setting in the options are, activate this accordion
                // group only if it equals that setting.  If we did not receive an
                // `accordionGroup` setting in the options are, activate this accordion
                // group if its "selected" attribute was true in the config file.
                if ((accordionGroupOption && (accGp === accordionGroupOption)) ||
                    (!accordionGroupOption && accGp.selectedInConfig)) {
                    accordionGroup = accGp;
                }
                var g = app.addAccordionSection($layerPickerAccordion, accGp.label);
                var selectBoxLayers = [];
                var sublistItems = [];
                for (var i = 0, j = accGp.sublists.length; i < j; i++) {
                    var sublist = accGp.sublists[i];
                    var sublistObj = {
                        heading : sublist.label,
                        items : [],
                        contentElement : $('<div><h4>' + sublist.label + '</h4></div>')
                    };
                    g.sublists.push(sublistObj);
                    sublistItems.push(sublistObj.contentElement);
                    var sublistLayerItems = [];
                    for (var k = 0, l = sublist.layers.length; k < l; k++) {
                        var layer = sublist.layers[k];
                        // remove any previously defined listeners for this layer, in case this isn't the first
                        // time we've been here
                        layer.removeAllListeners("activate");
                        layer.removeAllListeners("deactivate");
                        layer.removeAllListeners("transparency");
                        // listen for changes to this layer, and update share url accordingly
                        layer.addListener("activate", function () {
                            app.updateShareMapUrl();
                        });
                        layer.addListener("deactivate", function () {
                            app.updateShareMapUrl();
                        });
                        layer.addListener("transparency", function () {
                            app.updateShareMapUrl();
                        });

                        labelElem = document.createElement("label");
                        brElem = document.createElement("br");
                        textElem = document.createTextNode(layer.name);
                        labelElem.setAttribute("for", "chk" + layer.lid);
                        labelElem.appendChild(textElem);

                        //jdm 5/28/13: if there is a mask for this layer then we will provide a status
                        //as to when that mask is active
                        var $testForMask = layer.mask;
                        var radioButton;
                        var dropdownBox;
                        if ($testForMask) {
                            maskLabelElem = document.createElement("label");
                            maskTextElem = document.createTextNode(""); //empty until active, if active then put (m)
                            maskLabelElem.setAttribute("id", "mask-status" + layer.lid);
                            maskLabelElem.appendChild(maskTextElem);
                            sublistLayerItems.push([createLayerToggleCheckbox(layer),
                                                    labelElem,
                                                    createLayerPropertiesIcon(layer),
                                                    maskLabelElem,brElem]);
                        } else { //no mask for this layer (most will be of this type outside of FCAV)
                            // add the layer to the accordion group
                            if (sublist.type=="radiobutton") { //radio button type
                                sublistLayerItems.push([radioButton=createLayerToggleRadioButton(layer, sublist.label.replace(/\s+/g, '')),
                                                        labelElem,
                                                        createLayerPropertiesIcon(layer),brElem]);
                                app.radioButtonList.push(radioButton);
                                app.radioButtonLayers.push(layer);
                            } else if (sublist.type=="dropdownbox") { //dropdownbox type
                                // Using sublist.layers.length build up array of layer information to pass to 
                                // the dropdownbox such that only one call to createLayerToggleDropdownBox.
                                // Assumption #1: A dropdownbox is always preceded in the config file by a 
                                // radiobutton and therefore the dropdownbox needs to know about its corresponding radiobutton group
                                if (((selectBoxLayers.length+1)<sublist.layers.length) || (selectBoxLayers.length == undefined)){
                                    selectBoxLayers.push(layer);
                                    app.dropdownBoxLayers.push(layer);
                                } else {
                                    selectBoxLayers.push(layer);
                                    sublistLayerItems.push([dropdownBox=createLayerToggleDropdownBox(layer, selectBoxLayers, sublist.label.replace(/\s+/g, ''))]);
                                    app.dropdownBoxList.push(dropdownBox);
                                    app.dropdownBoxLayers.push(layer);
                                }
                            } else { // assume checkbox type
                                sublistLayerItems.push([createLayerToggleCheckbox(layer),
                                                        labelElem,
                                                        createLayerPropertiesIcon(layer),brElem]);
                            }
                        }

                        // Decide whether to activate the layer.  If we received a layer list in the
                        // options arg, active the layer only if it appears in that list.  If we
                        // received no layer list in the options arg, activate the layer if the layer's
                        // "selected" attribute was true in the config file.
                        if (((options.layers !== undefined) &&
                             (arrayContainsElement(options.layers, layer))) ||
                            ((options.layers === undefined) &&
                             layer.selectedInConfig) && (sublist.type!="radiobutton")) {
                            //console.log("activate at line 449");
                            layer.activate();
                        }
                        //we shouldn't have to re-activate an active layer on theme change
                        //But, rather just verify that it is checked as such
                        if (lids !== undefined) {
                            for (var m = 0; m < lids.length; m++) {
                                if ($("#chk"+lids[m])[0] !== undefined) {
                                    $("#chk"+lids[m])[0].checked = true;
                                }
                            }
                        }
                    } // end loop for sublist.layers
                    app.addAccordionSublistItems(sublistObj, sublistLayerItems);
                } // end loop for accGp.sublists
                app.addAccordionSublists(g, sublistItems);
                if (++a < theme.accordionGroups.length) {
                    ro1.step();
                } else {
                    //jdm 10/21/14: If the accordionGroup is not currently set,
                    //go ahead and assign it to the current accordion group
                    if (accordionGroup === undefined) {
                        accordionGroup = accGp.gid
                    }
                    defaultAccordionGroup = accordionGroup;
                    app.setThemeContinue(theme, options, accordionGroup);
                }
            }, 5);
            ro1.step();
            // } //end loop for theme.accordionGroups

            $layerPickerAccordion.accordion("refresh");
            // if page doesn't have layerPickerAccordion, insert it
            if (flag === true) {
                $("#layerPickerDialog").append($layerPickerAccordion);
            }

            return defaultAccordionGroup;

        }; //end setTheme

        this.shareUrl = function () {
            if (!this.currentTheme) { return undefined; }
            if (!this.currentAccordionGroup) { return undefined; }
            if (!this.currentBaseLayer) { return undefined; }

            var extent      = this.map.getExtent(),
                layerLids   = [],
                layerAlphas = [],
                layerMask   = [],
                url;

            if (!extent) { return undefined; }

            $.each(this.map.layers, function () {
                var op;
                if (! this.isBaseLayer) {
                    if (this.opacity === 1) {
                        op = "1";
                    } else if (this.opacity === 0) {
                        op = "0";
                    } else {
                        op = sprintf("%.2f", this.opacity);
                    }
                    if (stringContainsChar(this.name, 'MaskFor')) {
                        //if this layer is a mask add to layerMask list
                        if (layerMask.indexOf(this.seldonLayer.lid.substring(this.seldonLayer.lid.indexOf("MaskFor"),this.seldonLayer.lid.length).replace("MaskFor","")) == -1) {
                            layerMask.push(this.seldonLayer.lid.substring(this.seldonLayer.lid.indexOf("MaskFor"),this.seldonLayer.lid.length).replace("MaskFor",""));
                        }
                        //make sure the parent to the layerMask stays on the share map url
                        if (layerLids.indexOf(this.name.substring(0, this.name.indexOf("MaskFor"))) == -1) {
                            layerLids.push(this.name.substring(0, this.name.indexOf("MaskFor")));
                            layerAlphas.push(op);
                        }
                        var test = "";
                    } else {
                        //otherwise add to layerLids
                        if (this.seldonLayer) {
                            layerLids.push(this.seldonLayer.lid);
                            layerAlphas.push(op);
                        }
                    } //end
                }
            });

            url = window.location.toString();
            url = url.replace(/\?.*$/, '');
            url = url.replace(/\/$/, '');
            url = url.replace("#", '');
            return url + '?' + (new ShareUrlInfo({
                themeName         : this.currentTheme.name,
                layerLids         : layerLids,
                layerMask         : layerMask,
                layerAlphas       : layerAlphas,
                accordionGroupGid : this.currentAccordionGroup.gid,
                baseLayerName     : this.currentBaseLayer.name,
                extent            : extent
            })).urlArgs();
        };

        this.updateShareMapUrl = function () {
            if (this.currentTheme) {
                var url = this.shareUrl();
                if (url) {
                    $('#mapToolsDialog textarea.shareMapUrl').val(url);
                }
            }
        };

        this.launch = function (configFile, shareUrlInfo) {
            var app = this;

            $.ajax({
                url: configFile,
                dataType: "xml",
                success: function (configXML) {
                    app.parseConfig(configXML, shareUrlInfo);
                },
                error: function (jqXHR, textStatus, errorThrown) {
                    alert(textStatus);
                }
            });

            //
            // layerPicker button:
            //
            $("#btnTglLyrPick").click(function () {
                var $layerPickerDialog = $("#layerPickerDialog");
                if ($layerPickerDialog.dialog('isOpen')) {
                    $layerPickerDialog.dialog('close');
                } else {
                    $layerPickerDialog.dialog('open');
                }
            });

            //
            // turn layerPickerDialog div into a jQuery UI dialog:
            //
            $("#layerPickerDialog").dialog({ zIndex   : 10050,
                                             position : { my : "left top", at: "left+5 top+100"},
                                             autoOpen : true,
                                             hide     : "fade"
                                           });
            app.addListener("accordiongroupchange", function () {
                if (app.currentTheme) {
                    $('#layerPickerAccordion').accordion({
                            active      : app.currentTheme.getAccordionGroupIndex(app.currentAccordionGroup),
                            collapsible : true
                    });
                }
            });

            //
            // mapTools button:
            //
            $("#btnTglMapTools").click(function () {
                var $mapToolsDialog = $("#mapToolsDialog");
                if ($mapToolsDialog.dialog('isOpen')) {
                    $mapToolsDialog.dialog('close');
                } else {
                    $mapToolsDialog.dialog('open');
                }
            });

            //
            // turn mapToolsDialog div into a jQuery UI dialog:
            //
            $("#mapToolsDialog").dialog({ zIndex   : 10050,
                                          position : { my : "right top", at: "right-5 top+100"},
                                          autoOpen : true,
                                          hide     : "fade"
                                        });
            app.addListener("themechange", function () {
                app.updateShareMapUrl();
            });
            app.addListener("baselayerchange", function () {
                app.updateShareMapUrl();
            });
            app.addListener("accordiongroupchange", function () {
                app.updateShareMapUrl();
            });
            app.addListener("extentchange", function () {
                app.saveCurrentExtent();
                app.updateShareMapUrl();
                app.map.setOptions({maxExtent: app.map.getExtent()});
            });

            //
            // mapTools accordion
            //
            var $mapToolsAccordion = $("#mapToolsAccordion"),
                accordionGroupIndexToOpen = 0;

            //    initialize
            $mapToolsAccordion.accordion({
                heightStyle : 'content',
                collapsible : true
            });

            //    find the 'legend' layer in the mapTools accordion, and make sure it is initially turned on
            $mapToolsAccordion.find('div').each(function (i) {
                if (this.id === "legend") {
                    accordionGroupIndexToOpen = i;
                    return false;
                }
                return true;
            });
            $mapToolsAccordion.accordion('option', 'active', accordionGroupIndexToOpen);

            //
            // base layer combo change handler
            //
            $('#baseCombo').change(function () {
                var i = parseInt($(this).val(), 10);
                app.setBaseLayer(app.baseLayers[i]);
            });
            app.addListener("baselayerchange", function () {
                $('#baseCombo').val(app.currentBaseLayer.index);
            });

            //
            // theme layer combo change handler
            //
            $('#themeCombo').change(function () {
                var i = parseInt($(this).val(), 10);
                app.setTheme(app.themes[i]);
            });
            app.addListener("themechange", function () {
                $('#themeCombo').val(app.currentTheme.index);
            });

            //
            // pan button
            //
            $("#btnPan").click(function () {
                deactivateActiveOpenLayersControls();
                app.dragPanTool.activate();
            });

            //
            // print button
            //
            $("#btnPrint").click(function () {
                printMap();
            });

            //
            // zoom in button
            //
            $("#btnZoomIn").click(function () {
                deactivateActiveOpenLayersControls();
                app.zoomInTool.activate();
                activeBtn = $(this);
                activeBtn.children().addClass('icon-active');
            });

            //
            // zoom out button
            //
            $("#btnZoomOut").click(function () {
                deactivateActiveOpenLayersControls();
                app.zoomOutTool.activate();
                activeBtn = $(this);
                activeBtn.children().addClass('icon-active');
            });

            //
            // zoom to full extent button
            //
            $("#btnZoomExtent").click(function () {
                app.zoomToExtent(app.maxExtent);
            });

            //
            // identify button
            //
            $("#btnID").click(function () {
                activateIdentifyTool();
                activeBtn = $(this);
                activeBtn.children().addClass('icon-active');
            });

            //
            // about button
            //
            $("#btnAbout").click(function () {
                // I don't think the following line is needed. but am leaving it in
                // just in case - jrf
                //                deactivateActiveOpenLayersControls();
                var splashScreen = $("#splashScreenContainer");
                if (splashScreen.dialog("isOpen")) {
                    splashScreen.dialog("close");
                } else {
                    splashScreen.dialog("open");
                }
            });

            //
            // previous extent button
            //
            $("#btnPrev").click(function () {
                app.zoomToPreviousExtent();
            });

            //
            // next extent button
            //
            $("#btnNext").click(function () {
                app.zoomToNextExtent();
            });

            //
            // multigraph button
            //
            $("#btnMultiGraph").click(function () {
                activateMultigraphTool();
                activeBtn = $(this);
                activeBtn.children().addClass('icon-active');
            });

            //
            // splash screen
            //
            createSplashScreen();

            //Find Area
            var $findArea = $('#findArea');
            $findArea.findArea();
            areasList = $findArea.findArea('getAreasList');
            $findArea.autocomplete({
                source: areasList
            });
            $findArea.keypress(function (e) {
                if (e.which == 13) {
                    var areaExtent = $findArea.findArea('getAreaExtent', $findArea.val(), areasList);
                    app.zoomToExtent(areaExtent);
                }
            });

            //jdm: 7/9/12 - for global mask functionality
            $(function () {
                $('.mask-toggle').on('click', function () {
                    if ($(this).is(':checked')) {
                        //console.log("setMaskByMask at line 789");
                        app.setMaskByMask(true, this.value);
                    } else {
                        app.setMaskByMask(false, this.value);
                    }
                });
            });

            $('textarea').focus(function () {
                var $this = $(this);

                $this.select();

                // webkit issue
                window.setTimeout(function () {
                    $this.select();
                }, 1);

                function mouseUpHandler () {
                    // Prevent further mouseup intervention
                    $this.off("mouseup", mouseUpHandler);
                    return false;
                }

                $this.mouseup(mouseUpHandler);
            });

            // closes accordion tools by default on small browsers
            if ($(window).width() < 650) {
                $('#mapToolsDialog').dialog('close');
                $('#layerPickerDialog').dialog('close');
            }

            // closes and reopens accordion tools on mobile devices. They tend to lose their proper
            // position otherwise.
            if (window.addEventListener) {
                window.addEventListener("orientationchange", function () {
                    var $mapToolsDialog    = $('#mapToolsDialog'),
                        $layerPickerDialog = $('#layerPickerDialog');

                    window.scroll(0, 0);
                    if ($mapToolsDialog.dialog('isOpen')) {
                        $mapToolsDialog.dialog('close').dialog('open');
                    }

                    if ($layerPickerDialog.dialog('isOpen')) {
                        $layerPickerDialog.dialog('close').dialog('open');
                    }
                }, false);
            }

        }; //end app.launch()

        this.count = function (array, value) {
            var counter = 0;
            for(var i = 0; i < array.length; i++) {
                if (array[i] === value) counter++;
            }
            return counter;
        }

        this.addMaskToLegend = function (layer) {
            var maskName = layer.lid.substring(layer.lid.indexOf("MaskFor"),layer.lid.length);
            //clear out old legend graphic if necessary
            if ($(document.getElementById("lgd" + maskName))) {
                $(document.getElementById("lgd" + maskName)).remove();
            }
            layer.$legendItem = $(document.createElement("div")).attr("id", "lgd" + maskName)
            .prepend($(document.createElement("img")).attr("src", layer.legend))
            .prependTo($('#legend'))
            .click(function () {
                app.setMaskByMask(false, maskName);
            });
        }

        this.removeMaskFromLegend = function (layer) {}
        //jdm: 11/27-12/5/14 - re-wrote to use Mask object,  doing things in a more
        //object oriented fashion!
        this.setMaskByMask = function (toggle, maskName) {
            if (toggle) {
                //if ForestOnly grey out the sub-forest types
                if (maskName == "MaskForForest") {
                    $( "#ConiferForest" ).attr("disabled", true);
                    $( "#DeciduousForest" ).attr("disabled", true);
                    $( "#MixedForest" ).attr("disabled", true);
                }

                //console.log("creating new mask "+ maskName);
                var mask = new Mask(maskName);
                app.masks.push(mask);

                //Loop through app.map.layers making sure that
                //app.maskParentLayers is correct
                for (var l = 0; l < app.map.layers.length; l++) {
                    if (app.map.layers[l].seldonLayer) {
                        if (app.map.layers[l].seldonLayer.mask=="true") {
                            //console.log("count "+ app.count(app.maskParentLayers,app.map.layers[l].seldonLayer));
                            if (app.count(app.maskParentLayers,app.map.layers[l].seldonLayer)==0) {
                                app.maskParentLayers.push(app.map.layers[l].seldonLayer);
                                app.map.layers[l].seldonLayer.visible="true";
                            }
                        }
                    }
                }

                for (var mp = 0; mp < app.maskParentLayers.length; mp++) {
                    //console.log("creating maskLayer for "+ app.maskParentLayers[mp].name);
                     var maskLayer = new Layer({
                            lid              : app.maskParentLayers[mp].lid+maskName.replace("/",""),
                            visible          : 'true',
                            url              : app.maskParentLayers[mp].url,
                            srs              : app.maskParentLayers[mp].srs,
                            layers           : app.maskParentLayers[mp].layers+maskName.replace("/",""),
                            identify         : app.maskParentLayers[mp].identify,
                            name             : app.maskParentLayers[mp].lid+maskName.replace("/",""),
                            mask             : 'false',
                            legend           : app.maskParentLayers[mp].legend,
                            index            : app.maskParentLayers[mp].index
                    });
                    maskLayer.parentLayer = app.maskParentLayers[mp];
                    maskLayer.activate();
                    mask.maskLayers.push(maskLayer);
                    if (app.maskParentLayers[mp].visible=="true") {
                        app.maskParentLayers[mp].deactivate();
                        app.maskParentLayers[mp].visible=="false";
                    }
                    $("#"+maskName.replace("MaskFor","")).get(0).checked = true;
                    $('#mask-status'+ app.maskParentLayers[mp].lid).text("(m)");
                    $("#chk"+app.maskParentLayers[mp].lid).prop('checked', true);
                }
            } //end if (toggle)
            else { //we have just turned off a mask
                //if ForestOnly grey out the sub-forest types
                if (maskName=="MaskForForest") {
                    $( "#ConiferForest" ).attr("disabled", false);
                    $( "#DeciduousForest" ).attr("disabled", false);
                    $( "#MixedForest" ).attr("disabled", false);
                }
                //console.log("we have just turned off a mask "+ maskName);
                //Loop through app.masks and find maskName
                //When you find it, deactivate all of its maskLayers
                //Keep track of the number of mask in app.masks
                for (var m = 0; m < app.masks.length; m++) {
                    if (app.masks[m].maskName==maskName) {
                        for (var ml = 0; ml < app.masks[m].maskLayers.length; ml++) {
                            //console.log("deactivating maskLayer "+ app.masks[m].maskLayers[ml].name);
                            app.masks[m].maskLayers[ml].deactivate();
                        }
                        //Remove the mask from app.masks that you just cleared out
                        app.masks.remove(app.masks[m]);
                        $("#"+maskName.replace("MaskFor","")).get(0).checked = false;
                        $(document.getElementById("lgd" + maskName)).remove();
                    }
                }
                //If it was the only mask in app.Mask (e.g. app.masks.length ==0) to begin with
                //Then loop through app.maskParentLayers and activate those layer
                //Remove those layers from app.maskParentLayers that you just activated
                if (app.masks.length==0) {
                    var layersToRemove = [];
                    for (var mp = 0; mp < app.maskParentLayers.length; mp++) {
                        app.maskParentLayers[mp].activate();
                        app.maskParentLayers[mp].visible="true";
                        layersToRemove.push(app.maskParentLayers[mp]);
                    }
                    for (var l = 0; l < layersToRemove.length; l++) {
                        app.maskParentLayers.remove(layersToRemove[l]);
                        $('#mask-status'+ layersToRemove[l].lid).text("");
                    }
                }
            }
            app.updateShareMapUrl();
        }; //end app.setMaskByMask()

        this.setMaskByLayer = function (toggle, parentLayer) {
            if (toggle) {
                //console.log("adding new mask parent "+ parentLayer.name);
                app.maskParentLayers.push(parentLayer);
                for (var m = 0; m < app.masks.length; m++) {
                     var maskLayer = new Layer({
                            lid              : parentLayer.lid+app.masks[m].maskName.replace("/",""),
                            visible          : 'true',
                            url              : parentLayer.url,
                            srs              : parentLayer.srs,
                            layers           : parentLayer.layers+app.masks[m].maskName.replace("/",""),
                            identify         : parentLayer.identify,
                            name             : parentLayer.lid+app.masks[m].maskName.replace("/",""),
                            mask             : 'false',
                            legend           : parentLayer.legend,
                            index            : parentLayer.index
                    });
                    maskLayer.parentLayer = parentLayer;
                    maskLayer.activate();
                    app.masks[m].maskLayers.push(maskLayer);
                    if (parentLayer.visible=="true") {
                        parentLayer.deactivate();
                        parentLayer.visible="false";
                    }
                    $("#"+app.masks[m].maskName.replace("MaskFor","")).get(0).checked = true;
                    $('#mask-status'+ parentLayer.lid).text("(m)");
                    $("#chk"+parentLayer.lid).prop('checked', true);
                }
            }
            else {
                //deactivate and remove from mask.maskLayers[]
                for (var m = 0; m < app.masks.length; m++) {
                    var currentMask = app.masks[m];
                    var maskLayersToDelete = [];
                    for (var ml = 0; ml < app.masks[m].maskLayers.length; ml++) {
                        var currentMaskLayer = app.masks[m].maskLayers[ml];
                        if (currentMaskLayer.parentLayer.lid == parentLayer.lid) {
                            currentMaskLayer.deactivate();
                            $('#mask-status'+ currentMaskLayer.parentLayer.lid).text("")
                            maskLayersToDelete.push(currentMaskLayer);
                        }
                    }
                    for (var mld = 0; mld < maskLayersToDelete.length; mld++) {
                        currentMask.maskLayers.remove(maskLayersToDelete[mld]);
                    }
                }
                //remove from maskParentLayers and activate parentLayer
                app.maskParentLayers.remove(parentLayer);
                if (parentLayer.visible == "false") {
                    parentLayer.visible = "true";
                } else {
                    parentLayer.visible == "true";
                    parentLayer.deactivate();
                }
                $('#mask-status'+ parentLayer.lid).text("");
            }
            app.updateShareMapUrl();
        }; //end app.setMaskByLayer()

        this.parseConfig = require("./js/parse_config.js")($);

        this.initOpenLayers = function (baseLayerInfo, baseLayer, theme, themeOptions, initialExtent) {

            if (baseLayer.name.indexOf("Google") > -1) {
                var layer = new OpenLayers.Layer.Google("Google Streets", {numZoomLevels: 20});
            } else { //assume arcgis
                var layer = new OpenLayers.Layer.ArcGISCache("AGSCache", baseLayer.url, {
                    layerInfo: baseLayerInfo
                });
            }

            var maxExtentBounds = new OpenLayers.Bounds(app.maxExtent.left, app.maxExtent.bottom,
                                                        app.maxExtent.right, app.maxExtent.top);
            //console.log(maxExtentBounds);
            //console.log(initialExtent);

            if (initialExtent === undefined) {
                //take the extent coming from the config file
                initialExtent = app.maxExtent;
            } else {
                //take the extent of the share map url
                maxExtentBounds = new OpenLayers.Bounds(initialExtent.left, initialExtent.bottom,
                                                        initialExtent.right, initialExtent.top);
            }

            app.tileManager = new OpenLayers.TileManager({
                cacheSize: 12,
                moveDelay: 1000,
                zoomDelay: 1000
            });

            app.map = new OpenLayers.Map('map', {
                maxExtent:         maxExtentBounds,
                units:             'm',
                resolutions:       layer.resolutions,
                numZoomLevels:     layer.numZoomLevels,
                tileSize:          layer.tileSize,
                tileManager:       app.tileManager,
                controls: [
                    new OpenLayers.Control.Navigation({
                        dragPanOptions: {
                            enableKinetic: true
                        }
                    }),
                    new OpenLayers.Control.Attribution(),
                    app.zoomInTool,
                    app.zoomOutTool,
                    app.identifyTool,
                    app.multigraphTool
                ],
                eventListeners:
                {
                    "moveend": function() { app.emit("extentchange"); },
                    "zoomend": function() { app.emit("extentchange"); }
                },
                zoom: 1,
                projection: new OpenLayers.Projection(seldon.projection)
            });

            // set the base layer, but bypass setBaseLayer() here, because that function initiates an ajax request
            // to fetch the layerInfo, which in this case we already have
            this.currentBaseLayer = baseLayer;
            this.emit("baselayerchange");
            this.map.addControl(new OpenLayers.Control.ScaleLine({bottomOutUnits: 'mi'}));
            this.map.addLayers([layer]);
            this.map.setLayerIndex(layer, 0);
            // this.setTheme(theme, themeOptions);
            app.setAccordionGroup(this.setTheme(theme, themeOptions));
            this.zoomToExtent(initialExtent);
            this.map.events.register("mousemove", app.map, function (e) {
                var pixel = app.map.events.getMousePosition(e);
                var lonlat = app.map.getLonLatFromPixel(pixel);
                lonlat = lonlat.transform(new OpenLayers.Projection("EPSG:900913"), new OpenLayers.Projection("EPSG:4326"));
                OpenLayers.Util.getElement("latLonTracker").innerHTML = "Lat: " + sprintf("%.5f", lonlat.lat) + " Lon: " + sprintf("%.5f", lonlat.lon) + "";
            });
            app.map.addControl(new OpenLayers.Control.PanZoomBar());
        };

    };
    EventEmitter.declare(seldon.App);

    app = new seldon.App();

    function displayError (message) {
        //console.log(message);
    }

    seldon.init = require("./js/init.js")(app);
    var RepeatingOperation = require("./js/repeating_operation.js");
    var createArcGIS93RestParams = require("./js/create_arcgis_rest_params.js")($);
    var Mask = require("./js/mask.js");
    var Layer = require("./js/layer.js")($, app);
    var ShareUrlInfo = require("./js/share.js");
    var createLayerToggleDropdownBox = require("./js/layer_select.js")($, app);
    var createLayerToggleRadioButton = require("./js/layer_radio.js")($, app);
    var createLayerToggleCheckbox = require("./js/layer_checkbox.js")($);
    var createSplashScreen = require("./js/splash.js")($);
    var createLayerPropertiesIcon = require("./js/layer_icon.js")($);
    var createLayerPropertiesDialog = require("./js/layer_dialog.js")($);
    var ClickTool = require("./js/clicktool.js");
    var deactivateActiveOpenLayersControls = require("./js/deactivate_controls.js")(app, activeBtn);
    var activateIdentifyTool = require("./js/identify_activate.js")(app, activeBtn);
    var activateMultigraphTool = require("./js/multigraph_activate.js")(app, activeBtn);
    var stringContainsChar = require("./js/stringContainsChar.js");
    var arrayContainsElement = require("./js/array_contains_element.js");
    var extentsAreEqual = require("./js/extents_equal.js");
    var printMap = require("./js/print.js")($, app);
    require("./js/overrides.js")($);

    //
    // exports, for testing:
    //
//    seldon.BaseLayer                         = BaseLayer;
//    seldon.AccordionGroup                    = AccordionGroup;
//    seldon.AccordionGroupSublist             = AccordionGroupSublist;
    seldon.Layer                             = Layer;
//    seldon.Theme                             = Theme;
//    seldon.createWMSGetFeatureInfoRequestURL = createWMSGetFeatureInfoRequestURL;
    seldon.stringContainsChar                = stringContainsChar;
    seldon.ShareUrlInfo                      = ShareUrlInfo;
    window.seldon                            = seldon;

}(jQuery));
