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
			html += (value.qSortIndicator === 'A' ? "<i class='icon-triangle-top" : "<i class='icon-triangle-bottom");
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
			  	/*
				measures: {
					uses: "measures",
					min: 0
				},
				
				sorting: {
					uses: "sorting"
				},
				*/
				settings: {
					uses: "settings"
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
		paint: function ( $element ) {
		  	var html = "Choose table: <select id='tableSelector'><option value='-'>-</option></select><br><table><thead><tr>", 
				self = this, 
				lastrow = 0, 
				morebutton = false, 
				dimcount = this.backendApi.getDimensionInfos().length, 
				sortorder = this.backendApi.model.layout.qHyperCube.qEffectiveInterColumnSortOrder;
		
		  	
		  
		  
		  	//console.log(this.backendApi.getDimensionInfos());
		  
		  	//render titles
			this.backendApi.getDimensionInfos().forEach( function ( cell, index ) {
			  	html += formatHeader( index, cell, sortorder );
				//html += '<th>' + cell.qFallbackTitle + '</th>';
			} );
			this.backendApi.getMeasureInfos().forEach( function ( cell, index ) {
				html += formatHeader( index + dimcount, cell, sortorder );
			  	//html += '<th>' + cell.qFallbackTitle + '</th>';
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
					if ( !isNaN( cell.qNum ) ) {
						//html += " class='numeric'";
					  	html += "numeric ";
					}
				  
				  	if ( index < dimcount && cell.qElemNumber > -1 ) {
						html += "selectable' data-value='" + cell.qElemNumber + "' data-dimension='" + index + "'";
					} else {
						html += "'";
					}
				  	
					html += '>' + cell.qText + '</td>';
				} );
				html += '</tr>';
			} );
			html += "</tbody></table>";
			
		  	
		  
		  	//add 'more...' button
			if ( this.backendApi.getRowCount() > lastrow + 1 ) {
				html += "<button id='more'>More...</button>";
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
				$element.find( "#more" ).on( "qv-activate", function () {
					self.backendApi.getData( requestPage ).then( function ( dataPages ) {
						self.paint( $element );
					} );
				} );
			}

		  
			// Populate the dropdown.		  
		  	app.getTablesAndKeys(qWindowSize, qNullSize, 0, false, false).then(function(tables) {
				//console.log(data);
		  		qtr = tables.qtr;
				$.each(qtr, function(key, table) {   
		   			$('#tableSelector')
			   			.append($("<option></option>")
			   			.attr("value",table.qName)
			   			.text(table.qName)); 
	  			});
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
			  
			  
				self.backendApi.getProperties().then(function(reply) {
				  	
					//var tmpDimension = $.extend(true,{},reply.qHyperCubeDef.qDimensions[0]);
					var dimensions = [];
					$.each(qtr, function(key, table) {  
						if(table.qName == val) {
							reply.qHyperCubeDef.qInitialDataFetch[0].qWidth = table.qFields.length;
					  		
								$.each(table.qFields, function(key, column) {
									var tmpDimension = JSON.parse('{"qDef":{"qGrouping":"N","qFieldDefs":"","qFieldLabels":[""],"qSortCriterias":[{"qSortByAscii":1,"qSortByLoadOrder":1,"qExpression":{}}],"qNumberPresentations":[],"qActiveField":0,"autoSort":true,"cId":"","othersLabel":"Övriga"},"qOtherTotalSpec":{"qOtherMode":"OTHER_OFF","qOtherCounted":{"qv":"10"},"qOtherLimit":{"qv":"0"},"qOtherLimitMode":"OTHER_GE_LIMIT","qForceBadValueKeeping":true,"qApplyEvenWhenPossiblyWrongResult":true,"qOtherSortMode":"OTHER_SORT_DESCENDING","qTotalMode":"TOTAL_OFF","qReferencedExpression":{}},"qOtherLabel":{},"qTotalLabel":{},"qCalcCond":{}}');
								  	tmpDimension.qDef.cId = util.generateId();
									tmpDimension.qDef.qFieldDefs = [column.qName];
									dimensions.push(tmpDimension); 
								}); 
								
								reply.qHyperCubeDef.qDimensions = dimensions;
								self.backendApi.setProperties(reply);
								//console.log(reply);
								self.paint($element);
							
				  		}
				  	
					});
					//console.log(dimensions);	
		  		});
			});
		}
	};
} );
