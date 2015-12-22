define( ["qlik", "jquery", "text!./style.css","core.models/engine", "util"], function (qlik, $, cssContent, engine, util) {
	'use strict';
	
  	$( "<style>" ).html( cssContent ).appendTo( "head" );
  
  	var app = engine.currentApp;
  
  	var qWindowSize = {
			qcx : 1000,
			qcy : 1000
	};
  	var qNullSize = {
		qcx : 0,
		qcy : 0
	};
  	var qtr = null;
  	
  	
  	function setSortOrder ( self, col ) {
		//set this column first
		var sortorder = [col];
		//append the other columns in the same order
		self.backendApi.model.layout.qHyperCube.qEffectiveInterColumnSortOrder.forEach( function ( val ) {
			if ( val !== sortorder[0] ) {
				sortorder.push( val );
			}
		} );
		self.backendApi.applyPatches( [{
			'qPath': '/qHyperCubeDef/qInterColumnSortOrder',
			'qOp': 'replace',
			'qValue': '[' + sortorder.join( ',' ) + ']'
		}], true );
	}
  
  	function reverseOrder ( self, col ) {
	  	
		var hypercube = self.backendApi.model.layout.qHyperCube;
		var dimcnt = hypercube.qDimensionInfo.length;
		var reversesort = col < dimcnt ? hypercube.qDimensionInfo[col].qReverseSort :
			hypercube.qMeasureInfo[col - dimcnt].qReverseSort;
		self.backendApi.applyPatches( [{
			'qPath': '/qHyperCubeDef/' +
			( col < dimcnt ? 'qDimensions/' + col : 'qMeasures/' + ( col - dimcnt ) ) +
			'/qDef/qReverseSort',
			'qOp': 'replace',
			'qValue': ( !reversesort ).toString()
		}], true );
	}

	function formatHeader ( col, value, sortorder ) {
	  	
		var html =
			'<th data-col="' + col + '">' + value.qFallbackTitle ;
		//sort Ascending or Descending ?? add arrow
		if(value.qSortIndicator === 'A' || value.qSortIndicator === 'D') {
			html += (value.qSortIndicator === 'A' ? "<i class='icon-triangle-top icon-large" : "<i class='icon-triangle-bottom icon-large");
			if ( sortorder && sortorder[0] !== col ) {
				html += " secondary";
			}
			html += "'></i>";
		}
		html += "</th>";
		return html;
	}

  
  	
	return {
		initialProperties: {
			qHyperCubeDef: {
				qDimensions: [],
				qMeasures: [],
				qInitialDataFetch: [{
					qWidth: 10,
					qHeight: 100
				}]
			}
		},
	  	
		definition: {
			type: "items",
			component: "accordion",
			items: {
				dimensions: {
					uses: "dimensions",
					min: 0
				},
				settings: {
					uses: "settings"
				},
			  	table: {
					component : "items",
					label : "Table setting",
					items : {
					  
					  btnactive: {
						ref : "prop.Table",
						label : "Current selected table:",
						type : "string",
						defaultValue: "-"
					  }
					}
			  	},
			  	about: {
  					type: "items",
  					label: "About",
    				items: {
      					btninactive: {
      						type: "string",
      						label: "anders.uddenberg@exsitec.se",
      						ref: "about",
      						defaultValue: "https://github.com/ludberg/xtablebox"
      					}
    				}
				}
			}
		},
		
		snapshot: {
			canTakeSnapshot: true
		},
		paint: function ( $element, layout ) {
		  	var self = this, 
				lastrow = 0, 
				morebutton = false, 
				id = self.options.id,
				dimcount = this.backendApi.getDimensionInfos().length, 
				isMouseDown = false,
    			isHighlighted,
				columns = [],
				dragValues = [],
				selectedTable,
				dragColumn,
				sortorder = this.backendApi.model.layout.qHyperCube.qEffectiveInterColumnSortOrder;
		
		  	
		  	var html = "Select table: <select id='tableSelector_"+id+"'></select><br><table id='table_"+id+"'><thead><tr>";
		  
		  	
		  	// Fetches the prop: current selected table. This is used so we can make sure the correct select option is selected
		  	if(layout !== undefined && layout.prop !== undefined) {
				selectedTable = layout.prop.Table;
		 	}
		  	
		  
		  	//render titles
			this.backendApi.getDimensionInfos().forEach( function ( cell, index ) {
			  	html += formatHeader( index, cell, sortorder );
			  	columns.push(cell.qFallbackTitle);
				//html += '<th>' + cell.qFallbackTitle + '</th>';
			} );
			this.backendApi.getMeasureInfos().forEach( function ( cell, index ) {
				html += formatHeader( index + dimcount, cell, sortorder );
			  	//html += '<th>' + cell.qFallbackTitle + '</th>';
			  	columns.push(cell.qFallbackTitle);
			} );
			html += "</tr></thead><tbody>";
			
		 
		  
		  	//render data
			this.backendApi.eachDataRow( function ( rownum, row ) {
				lastrow = rownum;
				html += '<tr>';
				row.forEach( function ( cell, index  ) {
					if ( cell.qIsOtherCell ) {
						cell.qText = this.backendApi.getDimensionInfos()[index].othersLabel;
					}
					//html += '<td';
				  	html += "<td class='";
				  
				  	if(index == dimcount-1) {
						html += "lastcol ";
				  	}
				  
				 
				  
					if ( !isNaN( cell.qNum ) ) {
						//html += " class='numeric'";
					  	html += "numeric ";
					}
				  
				  	if ( index < dimcount && cell.qElemNumber > -1 ) {
						html += "selectable' data-value='" + cell.qElemNumber + "' data-dimension='" + index + "'";
					} else {
						html += "'";
					}
				  	
				    html += '>' + (cell.qText === undefined ? ' ' : cell.qText) + '</td>';
				} );
				html += '</tr>';
			} );
			html += "</tbody></table>";
			
		  	
		  
		  	//add 'more...' button
			if ( this.backendApi.getRowCount() > lastrow + 1 ) {
				html += "<button id='more_"+id+"'>More...</button>";
				morebutton = true;
			}
			$element.html( html );
			if ( morebutton ) {
				var requestPage = [{
					qTop: lastrow + 1,
					qLeft: 0,
					qWidth: this.backendApi.getDimensionInfos().length, //should be # of columns
					qHeight: Math.min( Math.floor(10000/this.backendApi.getDimensionInfos().length), this.backendApi.getRowCount() - lastrow )
				}];
				$element.find( "#more_"+id ).on( "qv-activate", function () {
					self.backendApi.getData( requestPage ).then( function ( dataPages ) {
						self.paint( $element );
					} );
				} );
			}

		  
			// Populate the dropdown.		  
		  	app.getTablesAndKeys(qWindowSize, qNullSize, 0, false, false).then(function(tables) {
				
		  		qtr = tables.qtr;
			  	$('#tableSelector_'+id)
						.find('option')
    					.remove()
    					.end()
						.append($('<option>', {
    						value: '-',
    						text: '-'
						}));
			  
				$.each(qtr, function(key, table) {   
		   			$('#tableSelector_'+id)
			   			.append($("<option></option>")
			   			.attr("value",table.qName)
						.prop("selected", (selectedTable == table.qName ? true : false))
			   			.text(table.qName)); 
	  			});
	  		});
		  
		  
		  	// Handle drag and select
		  	$('#table_'+id+' td')
    			.mousedown(function () {
				  	isMouseDown = true;
				  	dragColumn = $(this).context.cellIndex;
				  	
				  	// Set the css classes so each line is green. 
      				$(this).toggleClass("qv-st-data-cell");
				  	$(this).toggleClass("qv-st-data-cell-selected");
				  	
				  	// Remember the value for update when mouseup
				  	dragValues.push(parseInt( this.getAttribute( "data-value" ), 10 ));
				  	
      				
				  	isHighlighted = $(this).hasClass("qv-st-data-cell-selected");
      				//return false; // prevent text selection
    			})
    			.mouseover(function () {
      				if (isMouseDown) {
					  // We want to make sure the user is only selecting values in the column he/she started selecting values in (mousedown)
					  if(dragColumn == $(this).context.cellIndex) {
					  	$(this).toggleClass("qv-st-data-cell", isHighlighted);
        				$(this).toggleClass("qv-st-data-cell-selected", isHighlighted);
					  
						// Remember the value for update when mouseup
					  	dragValues.push(parseInt( this.getAttribute( "data-value" ), 10 ));
					  }
      				}
    			})
    			.bind("selectstart", function () {
      				return true;
    			});

  			$(document).mouseup(function () {
			  	if(isMouseDown && dragValues.length > 0) {
				  	
				  	// Selectes the values the user have highlighted in the table
					self.backendApi.selectValues(dragColumn,dragValues, true);
				  	
				  	dragColumn = null;
			  	} 
      			isMouseDown = false;
    		});
		  
		  
		  	$element.find( '.selectable' ).on( 'qv-activate', function () {
				if ( this.hasAttribute( "data-value" ) ) {
				  	var value = parseInt( this.getAttribute( "data-value" ), 10 ), dim = parseInt( this.getAttribute( "data-dimension" ), 10 );
					self.selectValues( dim, [value], true );
					$element.find( "[data-dimension='" + dim + "'][data-value='" + value + "']" ).toggleClass( "selected" );
				}
			} );
		  
		  	$element.find( 'th' ).on( 'qv-activate', function () {
				if ( this.hasAttribute( "data-col" ) ) {
					var col = parseInt( this.getAttribute( "data-col" ), 10 );
					setSortOrder( self, col );
				}
			} );
		  
		  	$element.find( 'th i' ).on( 'qv-activate', function () {
				var parent = this.parentNode;
				if ( parent.hasAttribute( "data-col" ) ) {
					var col = parseInt( parent.getAttribute( "data-col" ), 10 );
					reverseOrder( self, col );
				}
			} );
		  
		  	// On change handler
		  	$element.find('select, input').on('change', function() {
				var val = $(this).val() + '';
			  
			  	selectedTable = val;
			  	
			  	if(selectedTable != '-') {
				  
				  	// Update the property so that we remember which table was selected
				  	self.backendApi.getProperties().then(function(reply){  
        				reply.prop.Table = selectedTable;
				  		self.backendApi.setProperties(reply);  
					}); 
			  
					self.backendApi.getProperties().then(function(reply) {
				  		console.log("japp");
						//var tmpDimension = $.extend(true,{},reply.qHyperCubeDef.qDimensions[0]);
						var dimensions = [];
						$.each(qtr, function(key, table) {  
							if(table.qName == selectedTable) {
								reply.qHyperCubeDef.qInitialDataFetch[0].qWidth = table.qFields.length;
					  		
								$.each(table.qFields, function(key, column) {
									var tmpDimension = JSON.parse('{"qDef":{"qGrouping":"N","qFieldDefs":"","qFieldLabels":[""],"qSortCriterias":[{"qSortByAscii":1,"qSortByLoadOrder":1,"qExpression":{}}],"qNumberPresentations":[],"qActiveField":0,"autoSort":true,"cId":"","othersLabel":"Övriga"},"qOtherTotalSpec":{"qOtherMode":"OTHER_OFF","qOtherCounted":{"qv":"10"},"qOtherLimit":{"qv":"0"},"qOtherLimitMode":"OTHER_GE_LIMIT","qForceBadValueKeeping":true,"qApplyEvenWhenPossiblyWrongResult":true,"qOtherSortMode":"OTHER_SORT_DESCENDING","qTotalMode":"TOTAL_OFF","qReferencedExpression":{}},"qOtherLabel":{},"qTotalLabel":{},"qCalcCond":{}}');
								  	tmpDimension.qDef.cId = util.generateId();
									tmpDimension.qDef.qFieldDefs = [column.qName];
									dimensions.push(tmpDimension); 
								}); 
								
								reply.qHyperCubeDef.qDimensions = dimensions;
								self.backendApi.setProperties(reply);
								
								self.paint($element);
							
				  			}
				  	
						});
					
		  			});
				}
			});
			
		}
	};
} );
