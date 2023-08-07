/**
 * @NApiVersion 2.1
 * @NScriptType MapReduceScript
 */
 define(['N/encode', 'N/file', 'N/format', 'N/record', 'N/runtime', 'N/search'],
 /**
* @param{encode} encode
* @param{file} file
* @param{format} format
* @param{record} record
* @param{runtime} runtime
* @param{search} search
*/
// commit 3: from root folder
 (encode, file, format, record, runtime, search) => {
     /**
      * Defines the function that is executed at the beginning of the map/reduce process and generates the input data.
      * @param {Object} inputContext
      * @param {boolean} inputContext.isRestarted - Indicates whether the current invocation of this function is the first
      *     invocation (if true, the current invocation is not the first invocation and this function has been restarted)
      * @param {Object} inputContext.ObjectRef - Object that references the input data
      * @typedef {Object} ObjectRef
      * @property {string|number} ObjectRef.id - Internal ID of the record instance that contains the input data
      * @property {string} ObjectRef.type - Type of the record instance that contains the input data
      * @returns {Array|Object|Search|ObjectRef|File|Query} The input data to use in the map/reduce process
      * @since 2015.2
      */
     var PERIODS_STRUCTURE = {
        
         "721-More (QUANTITY)": 'SUM(formulanumeric)_7',
         "361-720 (QUANTITY)": 'SUM(formulanumeric)_6',
         "271-360 (QUANTITY)": 'SUM(formulanumeric)_5',
         "181-270 (QUANTITY)": 'SUM(formulanumeric)_4',
         "91-180 (QUANTITY)": 'SUM(formulanumeric)_3',
         "61-90 (QUANTITY)": 'SUM(formulanumeric)_2',
         "31-60 (QUANTITY)": 'SUM(formulanumeric)_1',
         "0-30 (QUANTITY)": 'SUM(formulanumeric)',
     }

     const getInputData = (inputContext) => {

         var searchId = runtime.getCurrentScript().getParameter('custscript_nappjo_inv_trns_cnsmd');
         log.debug('value of search', searchId)
         var inv_trans_cnsmd = search.load({
             id: searchId
         });
         return inv_trans_cnsmd;
     }

     /**
      * Defines the function that is executed when the map entry point is triggered. This entry point is triggered automatically
      * when the associated getInputData stage is complete. This function is applied to each key-value pair in the provided
      * context.
      * @param {Object} mapContext - Data collection containing the key-value pairs to process in the map stage. This parameter
      *     is provided automatically based on the results of the getInputData stage.
      * @param {Iterator} mapContext.errors - Serialized errors that were thrown during previous attempts to execute the map
      *     function on the current key-value pair
      * @param {number} mapContext.executionNo - Number of times the map function has been executed on the current key-value
      *     pair
      * @param {boolean} mapContext.isRestarted - Indicates whether the current invocation of this function is the first
      *     invocation (if true, the current invocation is not the first invocation and this function has been restarted)
      * @param {string} mapContext.key - Key to be processed during the map stage
      * @param {string} mapContext.value - Value to be processed during the map stage
      * @since 2015.2
      */

     const map = (mapContext) => {

         //log.debug('mapContext',mapContext.value)

         var searchRes = JSON.parse(mapContext.value)

         // log.debug('value of 2!!!',searchRes.values);
         searchRes = searchRes.values
         //var prCurr= searchRes.values.custbody_cust_req_currency.value;
         var itemVal = searchRes['GROUP(item)'].value
         var itemName = searchRes['GROUP(item)'].text
         var subsVal = searchRes['GROUP(subsidiary)'].value
         var subsTxt = searchRes['GROUP(subsidiary)'].text
         var totalCnsmd = searchRes['SUM(quantity)']
         var itemSubComb = itemVal + '-' + subsVal
         var obj = {}
         obj.itemVal = itemVal
         obj.itemName = itemName
         obj.subsVal = subsVal
         obj.subsTxt = subsTxt
         obj.totalCnsmd = Math.abs(totalCnsmd)

         mapContext.write({
             key: itemSubComb,
             value: obj
         });

     }

     /**
      * Defines the function that is executed when the reduce entry point is triggered. This entry point is triggered
      * automatically when the associated map stage is complete. This function is applied to each group in the provided context.
      * @param {Object} reduceContext - Data collection containing the groups to process in the reduce stage. This parameter is
      *     provided automatically based on the results of the map stage.
      * @param {Iterator} reduceContext.errors - Serialized errors that were thrown during previous attempts to execute the
      *     reduce function on the current group
      * @param {number} reduceContext.executionNo - Number of times the reduce function has been executed on the current group
      * @param {boolean} reduceContext.isRestarted - Indicates whether the current invocation of this function is the first
      *     invocation (if true, the current invocation is not the first invocation and this function has been restarted)
      * @param {string} reduceContext.key - Key to be processed during the reduce stage
      * @param {List<String>} reduceContext.values - All values associated with a unique key that was passed to the reduce stage
      *     for processing
      * @since 2015.2
      */
     const reduce = (reduceContext) => {

         var itemSubComb = reduceContext.key;
         var transInvObj = JSON.parse(reduceContext.values[0]);
         log.debug(itemSubComb, transInvObj)
         var itemVal = transInvObj.itemVal
         var itemName = transInvObj.itemName
         var subsVal = transInvObj.subsVal
         var subsTxt = transInvObj.subsTxt
         var totalCnsmd = transInvObj.totalCnsmd


         var searchId = runtime.getCurrentScript().getParameter('custscript_nappjo_inv_trns_rcv');
         var inv_trans_rcvd = search.load({
             id: searchId
         });

         var myFilter = search.createFilter({
             name: 'item',
             operator: search.Operator.ANYOF,
             values: itemVal
         })
         log.debug('myFilter' + itemVal, myFilter)

         inv_trans_rcvd.filters.push(myFilter);

         var myFilter = search.createFilter({
             name: 'subsidiary',
             operator: search.Operator.ANYOF,
             values: subsVal
         })

         inv_trans_rcvd.filters.push(myFilter);
         var searchResultCount = inv_trans_rcvd.runPaged().count;
         log.debug("transactionSearchObj result count", searchResultCount);
         var totalInvAging = 0
         var objct = {};
         objct.itemName = itemName
         objct.subsTxt = subsTxt
         inv_trans_rcvd.run().each(function (result) {
             for (var period in PERIODS_STRUCTURE) {
                 var clmn = PERIODS_STRUCTURE[period]
               
                 var itemid = result.getValue({
                     name: "item",
                     summary: "GROUP",
                     label: "Item"
                 })
                 var subs = result.getValue({
                     name: "subsidiary",
                     summary: "GROUP",
                     label: "Subsidiary"
                 })
                 var result_1 = JSON.stringify(result)
                 var result_1 = JSON.parse(result_1)
                 var rcvQty_forPeriod = result_1.values[clmn]
                 var invAgingVal;
                 log.debug(totalCnsmd+'...totalCnsmd.....rcvQty_forPeriod',rcvQty_forPeriod)
                 if (totalCnsmd >= rcvQty_forPeriod) {
                     invAgingVal = 0
                 } else {
                     invAgingVal = rcvQty_forPeriod - totalCnsmd
                 }
                 totalInvAging = totalInvAging + invAgingVal
                 objct[clmn] = invAgingVal
                 totalCnsmd = totalCnsmd - rcvQty_forPeriod
                 if(totalCnsmd<0){
                     totalCnsmd=0
                 }
                 log.debug('invAgingVal.....',invAgingVal)
             }

             return true;
         });
         var itemDetails = getOnHandInTransit(itemName,subsVal);
         objct.totalInvAging = totalInvAging
         objct.onHand = itemDetails.onHand
         objct.inTransit = itemDetails.inTransit
         objct.avgCost = itemDetails.avgCost
         log.debug('objct',objct)
         reduceContext.write({
             key: itemSubComb,
             value: objct
         });





     }


     /**
      * Defines the function that is executed when the summarize entry point is triggered. This entry point is triggered
      * automatically when the associated reduce stage is complete. This function is applied to the entire result set.
      * @param {Object} summaryContext - Statistics about the execution of a map/reduce script
      * @param {number} summaryContext.concurrency - Maximum concurrency number when executing parallel tasks for the map/reduce
      *     script
      * @param {Date} summaryContext.dateCreated - The date and time when the map/reduce script began running
      * @param {boolean} summaryContext.isRestarted - Indicates whether the current invocation of this function is the first
      *     invocation (if true, the current invocation is not the first invocation and this function has been restarted)
      * @param {Iterator} summaryContext.output - Serialized keys and values that were saved as output during the reduce stage
      * @param {number} summaryContext.seconds - Total seconds elapsed when running the map/reduce script
      * @param {number} summaryContext.usage - Total number of governance usage units consumed when running the map/reduce
      *     script
      * @param {number} summaryContext.yields - Total number of yields when running the map/reduce script
      * @param {Object} summaryContext.inputSummary - Statistics about the input stage
      * @param {Object} summaryContext.mapSummary - Statistics about the map stage
      * @param {Object} summaryContext.reduceSummary - Statistics about the reduce stage
      * @since 2015.2
      */
     const summarize = (summaryContext) => {
         
             log.debug('Summary stage LOG JSON....', JSON.stringify(summaryContext));
             var agingReportDS=[]
         try{
             summaryContext.output.iterator().each(function (key, value) {
                log.debug(key,value)
                value=value+''
                var xdata=JSON.parse(value)
               

                 agingReportDS.push(xdata)
              
 
 
                 return true;
             });
            var fileID= createFile(agingReportDS);

         }catch(e){
             log.debug('e',e)
         }
         

        
     }
     function createFile(dataset) {
         log.debug('creating file function !!!!!')

         var xmlString = '<?xml version="1.0"?>';
         xmlString += '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" ';
         xmlString += 'xmlns:o="urn:schemas-microsoft-com:office:office" ';
         xmlString += 'xmlns:x="urn:schemas-microsoft-com:office:excel" ';
         xmlString += 'xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet" ';
         xmlString += 'xmlns:html="http://www.w3.org/TR/REC-html40">';

         xmlString += '<Worksheet ss:Name="Sheet1">';
         xmlString += '<Table>' +
             '<Row>' +
             '<Cell><Data ss:Type="String">Item</Data></Cell>' +
             '<Cell><Data ss:Type="String">Subsidiary</Data></Cell>' 
             
         var tempheader=''
         for (var period in PERIODS_STRUCTURE) {
             tempheader = '<Cell><Data ss:Type="String">'+period+'</Data></Cell><Cell><Data ss:Type="String">'+period.replace("QUANTITY", "AMOUNT")+'</Data></Cell>'+tempheader
         
         }
         xmlString +=tempheader
         xmlString += '<Cell><Data ss:Type="String">Total</Data></Cell>'
         //xmlString += '<Cell><Data ss:Type="String">On Hand</Data></Cell>'
         xmlString += '<Cell><Data ss:Type="String">In Transit</Data></Cell>'
    
         xmlString +='</Row>';
         log.debug('xml string',xmlString)
             
          for (var i = 0; i < dataset.length; i++) {
             xmlString += '<Row>' +
                 '<Cell><Data ss:Type="String">' + dataset[i].itemName + '</Data></Cell>' +
                 '<Cell><Data ss:Type="String">' + dataset[i].subsTxt + '</Data></Cell>' 
                 var data=dataset[i]
                 var avgCost=data.avgCost
                 if(!isEmpty(avgCost)){
                    avgCost=parseFloat(avgCost)
                 }
                 var tempbody=''
                 for (var period in PERIODS_STRUCTURE) {
                    var clmn= PERIODS_STRUCTURE[period]
                    var agng=data[clmn]
                    var amount=0
                    if(!isEmpty(agng)){
                        if(!Number.isInteger(agng)){
                            agng=parseFloat(agng)
                            agng= agng.toFixed(2)
                          
                        }
                         amount= agng*avgCost
                        if(!Number.isInteger(amount)){
                            amount= amount.toFixed(2)
                        }
                        log.debug(agng,amount)
                    }
                    if(isEmpty(agng)){
                    agng=0
                    }
                    if(isEmpty(amount)){
                    amount=0
                    }
                    

                    tempbody = '<Cell><Data ss:Type="String">' + agng + '</Data></Cell><Cell><Data ss:Type="String">' + amount + '</Data></Cell>'+tempbody
                 
                 }
                var ttlInvAging=0
            	var onhnd=0
                var intrans=0
                if(!isEmpty(data.onHand)){
                  onhnd= data.onHand
                }
                if(!isEmpty( data.inTransit)){
                  intrans= data.inTransit
                }
                if(!isEmpty(data.totalInvAging)){
                  ttlInvAging= data.totalInvAging
                }
                 xmlString +=tempbody
                 xmlString += '<Cell><Data ss:Type="String">' + ttlInvAging + '</Data></Cell>'
                 //xmlString += '<Cell><Data ss:Type="String">' +onhnd + '</Data></Cell>'
                 xmlString += '<Cell><Data ss:Type="String">' + intrans + '</Data></Cell>'
                 xmlString +='</Row>';
         
         }



         xmlString += '</Table></Worksheet></Workbook>';

         var base64EncodedString = encode.convert({
             string: xmlString,
             inputEncoding: encode.Encoding.UTF_8,
             outputEncoding: encode.Encoding.BASE_64
         });
         var d = new Date();
        
         var xlsFile = file.create({ name: 'Inventory_Aging_Report.xls', fileType: 'EXCEL', contents: base64EncodedString });
         var folderName = runtime.getCurrentScript().getParameter('custscript_aging_fldr_id');
         log.audit('folder Name', folderName)
         var folderid= getAgingFolderId(folderName)
         xlsFile.folder = folderid;
         log.audit('folder folderid', folderid)
         var fileId = xlsFile.save();
         log.debug('creating file!!!!!',fileId)
         return fileId;

     }
     function getOnHandInTransit(itemNm,subs) {
         var itemSearchObj = search.create({
             type: "item",
             filters:
             [
                ["isinactive","is","F"], 
                "AND", 
                ["name","is",itemNm], 
                "AND", 
                ["inventorylocation.subsidiary","anyof",subs]
             ],
             columns:
             [
                search.createColumn({
                   name: "itemid",
                   summary: "GROUP",
                   sort: search.Sort.ASC,
                   label: "Name"
                }),
                search.createColumn({
                   name: "locationquantityonhand",
                   summary: "SUM",
                   label: "Location On Hand"
                }),
                search.createColumn({
                   name: "locationquantityintransit",
                   summary: "SUM",
                   label: "Location In Transit"
                }),
                search.createColumn({
                   name: "averagecost",
                   summary: "MAX",
                   label: "Average Cost"
                })
             ]
          });
         var searchResultCount = itemSearchObj.runPaged().count;
         log.debug("itemSearchObj result count", searchResultCount);
         var retObj = {}
         itemSearchObj.run().each(function (result) {
             var onHand = result.getValue({
                 name: "locationquantityonhand",
                 summary: "SUM",
                 label: "Location On Hand"
             })
             if (isEmpty(onHand)) {
                 onHand = 0
             }
             retObj.onHand = onHand
             var inTransit = result.getValue({
                 name: "locationquantityintransit",
                 summary: "SUM",
                 label: "Location In Transit"
             })
             if (isEmpty(inTransit)) {
                 inTransit = 0
             }
             retObj.inTransit = inTransit
             var avgCost = result.getValue({
                 name: "averagecost",
                 summary: "MAX",
                 label: "Average Cost"
             })
             if (isEmpty(avgCost)) {
                 avgCost = 0
             }
             retObj.avgCost = avgCost

             return true;
         });
         return retObj
     }

     function isEmptyObject(obj) {
         for (var key in obj) {
             if (obj.hasOwnProperty(key))
                 return false;
         }
         return true;
     }
     function isEmpty(stValue) {
         if ((stValue == null) || (stValue == '') || (stValue == undefined) || (stValue == 'undefined')) {
             return true;
         } else {
             return false;
         }
     }
     function getAgingFolderId(folderName){
         var fileSearchObj = search.create({
               type: "file",
               filters:
               [
                   ["formulatext: {folder}","is",folderName]
               ],
               columns:
               [
                  search.createColumn({name: "name", label: "Name"}),
                  search.createColumn({name: "folder", label: "Folder"}),
                  search.createColumn({name: "documentsize", label: "Size (KB)"}),
                  search.createColumn({name: "url", label: "URL"}),
                  search.createColumn({
                     name: "created",
                     sort: search.Sort.DESC,
                     label: "Date Created"
                  }),
                  search.createColumn({name: "modified", label: "Last Modified"}),
                  search.createColumn({name: "filetype", label: "Type"}),
                  search.createColumn({name: "internalid", label: "Internal ID"})
               ]
            });
            var searchResultCount = fileSearchObj.runPaged().count;
            log.debug("fileSearchObj result count",searchResultCount);
            var folderid=''
            fileSearchObj.run().each(function(result){
               folderid=result.getValue('folder')
               return true;
            });
            return folderid

     }

     return { getInputData, map, reduce, summarize }

 });