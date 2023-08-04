/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 */
define(['N/ui/serverWidget', 'N/record', 'N/redirect', 'N/runtime', 'N/format', 'N/ui/message', 'N/task', 'N/search', 'N/config'],
    /**
   * @param{serverWidget} serverWidget
   @param{record} record
   @param{redirect} redirect
   @param{runtime} runtime
   @param{format} format
   @param{task} task
   @param{search} search
   @param{config} config
   @param {message} message
   */
    (serverWidget, record, redirect, runtime, format, message, task, search, config) => {
        /**
         * Defines the Suitelet script trigger point.
         * @param {Object} scriptContext
         * @param {ServerRequest} scriptContext.request - Incoming request
         * @param {ServerResponse} scriptContext.response - Suitelet response
         * @since 2015.2
         */
        const ScriptParam = Object.freeze({
            SAVED_SEARCH: 'custscript_report_saved_search',
            TASK_ID: 'custscript_nappjo_aging_rprt_taskid',
            SCRIPT_ID:'custscript_nappjo_mr_script_id',
            DEPLOY_ID:'custscript_nappjo_mr_deploy_id'
        });

        const onRequest = (context) => {
            var flag = true;
            var request = context.request;
            var response = context.response;
            var form = serverWidget.createForm({
                title: 'Inventory Aging',
            });

            var objSc = runtime.getCurrentScript();
            var TaskkId = objSc.getParameter({
                name: ScriptParam.TASK_ID
            });
            var logoObj=getLogosUrl();
            var excelLogo=logoObj.excel
            var loaderGif=logoObj.loading
            var greenCheckicon=logoObj.greencheck
            
            if (!isEmpty(TaskkId)) {
                var InitTaskStatus = task.checkStatus({
                    taskId: TaskkId
                });
                log.audit('Inside if', InitTaskStatus.status);
                var statuRef = InitTaskStatus.status;
                if (statuRef.trim() == 'PENDING' || statuRef.trim() == 'PROCESSING') {
                    flag = false;
                    log.debug('changed Flag', flag)
                }
                else {
                    var companypref = config.load({
                        type: config.Type.COMPANY_PREFERENCES
                    });
                    companypref.setValue({
                        fieldId: 'custscript_nappjo_aging_rprt_taskid',
                        value: ''
                    });
                    companypref.save();
                }

            }
            var containergetvalue ='';

            if (request.method === 'GET' && flag == true) {
                var fieldgroup1 = form.addFieldGroup({
                    id : 'aging_rprt_title_grp',
                    label: 'Information'
                });

                form.addSubmitButton('Trigger');
                var textLine = form.addField({
                    id: 'custpage_text',
                    type: serverWidget.FieldType.INLINEHTML,
                    label: 'test',
                    container: 'aging_rprt_title_grp'
                }).defaultValue = "<p style='font-size:14px; margin-top:20px'>Click on the Trigger button to prepare the Inventory Aging Report. You can download last prepared report from the link below.</p>";
                var objScript = runtime.getCurrentScript();
                var SSId = objScript.getParameter({
                    name: ScriptParam.SAVED_SEARCH
                });
                log.debug('saved search GET: ' + SSId);
                if (!SSId) {
                    throw error.create({
                        name: 'MISSING_PARAMETER',
                        message: 'Parameter "Saved Search" is mandatory'
                    });
                }
                var objSS = search.load({
                    id: SSId
                });
                var url = '';
                var datecreated = '';
                objSS.run().each(function (result) {
                    // .run().each has a limit of 4,000 results
                    url = result.getValue('url');
                    datecreated = result.getValue('modified');
                    return false;
                });

                // form.addField({
                //     id: 'custpage_text_temp',
                //     type: serverWidget.FieldType.INLINEHTML,
                //     label: 'Aging Report',
                //     value: objSS.name
                // }).defaultValue = "Test";
                var fieldgroup2 = form.addFieldGroup({
                    id : 'aging_rprt_grp',
                    label: 'Inventory Aging Report'
                });
                containergetvalue= 'aging_rprt_grp'
                var fileField = form.addField({
                    id: 'custpage_text_file_get',
                    type: serverWidget.FieldType.INLINEHTML,
                    label: 'Aging Report',
                    container: containergetvalue
                }).defaultValue = "<br></br><img src='"+excelLogo+"' style='height:20px; width: auto; '></img>" + "<a style='font-size:14px;' href=" + url + ">Aging Report </a>" + "&emsp; &emsp; <b style='font-size:14px;'> Report Generation Timestamp - " + datecreated + "</b>";
                   
            }
            else {
                var objSc = runtime.getCurrentScript();
                var mrTaskId2 = objSc.getParameter({
                    name: ScriptParam.TASK_ID
                });
                var mrscriptid = objSc.getParameter({
                    name: ScriptParam.SCRIPT_ID
                });
                var mrdeployid = objSc.getParameter({
                    name: ScriptParam.DEPLOY_ID
                });
                let mrTaskId = request.parameters.custpage_task_id;
            
                //isEmpty Function Below
                if (isEmpty(mrTaskId) && isEmpty(mrTaskId2)) {
                    let mrTask = task.create({
                        taskType: task.TaskType.MAP_REDUCE,
                        scriptId: mrscriptid,
                        deploymentId: mrdeployid
                    });

                    // Submit the map/reduce task
                    mrTaskId = mrTask.submit();
                }
                if (!isEmpty(mrTaskId2)) {
                    mrTaskId = mrTaskId2;
                }
                //Task Status 
                log.debug('mrTaskId', mrTaskId);
                var TaskStatus = task.checkStatus({
                    taskId: mrTaskId
                });

                log.debug('Task Status', TaskStatus);
                form.addSubmitButton('Refresh');

                var taskIdfld = form.addField({
                    id: 'custpage_task_id',
                    type: serverWidget.FieldType.TEXT,
                    label: 'Task ID',
                    value: mrTaskId
                }).updateDisplayType({
                    displayType: serverWidget.FieldDisplayType.HIDDEN
                });
                taskIdfld.defaultValue = mrTaskId;
                var fieldgroupstatus = form.addFieldGroup({
                    id : 'aging_rprt_status',
                    label: 'Task Status'
                });

                var taskstatus = form.addField({
                    id: 'custpage_task_status',
                    type: serverWidget.FieldType.INLINEHTML,
                    label: 'Task Status',
                    value: TaskStatus.status,
                    container: 'aging_rprt_status'
                });
                if (TaskStatus.status != 'COMPLETE') {
                    dots = '...';
                    taskstatus.defaultValue = "<p style='font-size:14px'>It can take saveral minutes to prepare inventory aging report. You can comeback to this page or refresh the page to get latest status.</p><br></br><p style='font-size:14px'>Aging Report Status:" + TaskStatus.status + "<img src='"+loaderGif+"' style='height:20px; width: auto'></img></p>"
                }

                else {
                    taskstatus.defaultValue = "<p style='font-size:14px; margin-top:20px;'>Aging Report Status: " + TaskStatus.status +' '+ "<img src='"+greenCheckicon+"' style='height:20px; width: auto;'></img></p>"
                }


                var taskIdfld = request.parameters.custpage_task_id;

                taskIdfld = mrTaskId;
                log.debug('taskIdfld', taskIdfld);
                var companypref = config.load({
                    type: config.Type.COMPANY_PREFERENCES
                });
                companypref.setValue({
                    fieldId: 'custscript_nappjo_aging_rprt_taskid',
                    value: mrTaskId
                });
                companypref.save();
                log.debug('Company pref task id', companypref);
                // Saved Search for Aging Report
                var objScript = runtime.getCurrentScript();
                var SSId = objScript.getParameter({
                    name: ScriptParam.SAVED_SEARCH
                });
                log.debug('saved search: ' + SSId);
                if (!SSId) {
                    throw error.create({
                        name: 'MISSING_PARAMETER',
                        message: 'Parameter "Saved Search" is mandatory'
                    });
                }
                var objSS = search.load({
                    id: SSId
                });
                var url = '';
                var datecreated = '';
                objSS.run().each(function (result) {
                    // .run().each has a limit of 4,000 results
                    url = result.getValue('url');
                    datecreated = result.getValue('modified');
                    return false;
                });
                log.debug('objss saved search report name', objSS);
                log.debug('objss saved search report URL', objSS.scriptId);
                log.debug('Task Status', TaskStatus.status)
                // var fieldgroup12 = form.addFieldGroup({
                //     id : 'aging_rprt_title_grp2',
                //     label: 'Important Announcement'
                // });
               
                var fieldgroup3 = form.addFieldGroup({
                    id : 'aging_rprt_grp_post',
                    label: 'Inventory Aging Report'
                });
                if (TaskStatus.status == "COMPLETE") {

                    var fileField = form.addField({
                        id: 'custpage_text_file',
                        type: serverWidget.FieldType.INLINEHTML,
                        label: 'Aging Report',
                       container: 'aging_rprt_grp_post' 
                    }).defaultValue = "<br></br><img src='"+excelLogo+"' style='height:20px; width: auto; '></img>" + "<a style='font-size:14px;' href=" + url + ">Aging Report </a>" + "&emsp; &emsp; <b style='font-size:14px;'> Report Generation Timestamp - " + datecreated + "</b>";

                }
            }
            context.response.writePage(form);

        }
        function isEmpty(stValue) {
            if ((stValue == '') || (stValue == null) || (stValue == undefined) || (stValue == 'null')) {
                return true;
            }
            return false;
        }
        function getLogosUrl(){
            var fileSearchObj = search.create({
               type: "file",
               filters:
               [
                  ["formulatext: {folder}","is","Nappjo Logos"]
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
            var obj={};
            fileSearchObj.run().each(function(result){
               var name= result.getValue('name')
               var url=result.getValue('url')
               if(name.indexOf('loading-animated')>=0){
               obj.loading=url

               }else if(name.indexOf('excel')>=0){
               obj.excel=url
               
               }else{
               obj.greencheck=url
               }
               
               return true;
            });
            log.debug('logos Obj...', obj)
            return obj
        }
        return { onRequest }
    });