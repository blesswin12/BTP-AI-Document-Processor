sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/m/MessageToast",
    "sap/ui/model/json/JSONModel"
], (Controller, MessageToast, JSONModel) => {
    "use strict";

    return Controller.extend("com.sap.docai.frontend.controller.View1", {

        onInit: function () {
            var oViewModel = new JSONModel({
                isExtracting:     false,
                isError:          false,
                statusMessage:    "",
                extractedData:    "",
                // Doc summary fields
                docFileName:      "",
                docNumber:        "",
                docDate:          "",
                docType:          "",
                docStatus:        "",
                docPages:         "",
                docLanguage:      "",
                docSender:        "",
                docReceiver:      "",
                docGrossAmount:   "",
                docNetAmount:     "",
                docTaxAmount:     "",
                docCurrency:      "",
                // Table data
                headerFields:     [],
                headerFieldCount: "",
                lineItems:        [],
                lineItemCount:    ""
            });
            this.getView().setModel(oViewModel, "appView");
        },

        // ── Extract button handler ────────────────────────────────────
        onExtractData: function () {
            var oFileUploader = this.byId("pdfUploader");
            var domRef = document.getElementById(oFileUploader.getId() + "-fu");
            var oFile  = domRef && domRef.files && domRef.files.length > 0 ? domRef.files[0] : null;

            if (!oFile) {
                MessageToast.show("Please select a PDF file first.");
                return;
            }

            var oViewModel = this.getView().getModel("appView");
            oViewModel.setProperty("/isExtracting", true);
            oViewModel.setProperty("/isError",      false);
            oViewModel.setProperty("/extractedData", "");
            oViewModel.setProperty("/statusMessage", "⏳ Uploading document...");
            this._clearResults(oViewModel);

            var formData = new FormData();
            formData.append("file", oFile);

            // Step 1: Upload and create job
            var sDocumentType = this.byId("docTypeSelect").getSelectedKey();
            fetch("/api/uploadDocument?documentType=" + encodeURIComponent(sDocumentType), { method: "POST", body: formData })
            .then(res => {
                if (!res.ok) return res.json().then(e => { throw new Error(JSON.stringify(e)); });
                return res.json();
            })
            .then(jobData => {
                var jobId = jobData.id;
                if (!jobId) throw new Error("No job ID returned: " + JSON.stringify(jobData));
                oViewModel.setProperty("/statusMessage", "⏳ Job created · waiting for AI extraction...");
                return this._pollForResult(jobId, oViewModel);
            })
            .then(finalData => {
                oViewModel.setProperty("/isExtracting", false);
                oViewModel.setProperty("/isError",      false);
                oViewModel.setProperty("/statusMessage", "✅ Extraction complete!");
                this._populateResults(finalData, oViewModel);
                MessageToast.show("Document extracted successfully!");
            })
            .catch(error => {
                oViewModel.setProperty("/isExtracting", false);
                oViewModel.setProperty("/isError",      true);
                oViewModel.setProperty("/statusMessage", "❌ " + error.message);
                MessageToast.show("Extraction failed.");
            });
        },

        // ── Poll until DONE ───────────────────────────────────────────
        _pollForResult: function (jobId, oViewModel, attempt) {
            attempt = attempt || 0;
            if (attempt > 40) return Promise.reject(new Error("Timed out waiting for result."));

            oViewModel.setProperty("/statusMessage", "⏳ Processing · attempt " + (attempt + 1) + "/40...");

            return fetch("/api/getJobResult?jobId=" + encodeURIComponent(jobId))
            .then(r => r.json())
            .then(data => {
                if (data.status === "DONE")   return data;
                if (data.status === "FAILED") throw new Error("DIEx job failed.");
                return new Promise(resolve => setTimeout(resolve, 3000))
                    .then(() => this._pollForResult(jobId, oViewModel, attempt + 1));
            });
        },

        // ── Populate all model properties from DIEx response ──────────
        _populateResults: function (data, oViewModel) {
            var extraction = data.extraction || {};

            // ── Raw JSON ──────────────────────────────────────────────
            oViewModel.setProperty("/extractedData", JSON.stringify(data, null, 2));

            // ── Doc summary ───────────────────────────────────────────
            oViewModel.setProperty("/docFileName", data.fileName   || "");
            oViewModel.setProperty("/docStatus",   data.status     || "");
            oViewModel.setProperty("/docType",     data.documentType || "");
            oViewModel.setProperty("/docPages",    String(data.pageCount || ""));
            oViewModel.setProperty("/docLanguage", (data.languageCodes || []).join(", "));

            // ── Deduplicate header fields (keep highest confidence) ───
            var fieldMap = {};
            (extraction.headerFields || []).forEach(function (f) {
                if (!fieldMap[f.name] || f.confidence > fieldMap[f.name].confidence) {
                    fieldMap[f.name] = f;
                }
            });

            var fields = Object.values(fieldMap);

            // Populate summary shortcut fields
            var get = function (name) { return fieldMap[name] ? String(fieldMap[name].value) : "—"; };
            oViewModel.setProperty("/docNumber",     get("documentNumber"));
            oViewModel.setProperty("/docDate",       get("documentDate"));
            oViewModel.setProperty("/docSender",     get("senderName"));
            oViewModel.setProperty("/docReceiver",   get("receiverName"));
            oViewModel.setProperty("/docCurrency",   get("currencyCode"));
            oViewModel.setProperty("/docGrossAmount", get("grossAmount"));
            oViewModel.setProperty("/docNetAmount",  get("netAmount"));
            oViewModel.setProperty("/docTaxAmount",  get("taxAmount"));

            // ── Header fields table ───────────────────────────────────
            var tableFields = fields.map(function (f) {
                return {
                    label:         f.label || f.name,
                    category:      f.category || "other",
                    value:         String(f.value),
                    confidence:    f.confidence,
                    confidencePct: Math.round(f.confidence * 100)
                };
            });

            // Sort: amounts first, then by confidence desc
            tableFields.sort(function (a, b) {
                if (a.category === "amounts" && b.category !== "amounts") return -1;
                if (b.category === "amounts" && a.category !== "amounts") return  1;
                return b.confidence - a.confidence;
            });

            oViewModel.setProperty("/headerFields",     tableFields);
            oViewModel.setProperty("/headerFieldCount", String(tableFields.length));

            // ── Line items table ──────────────────────────────────────
            var lineItems = (extraction.lineItems || []).map(function (item, idx) {
                var m = {};
                item.forEach(function (f) { m[f.name] = f; });
                return {
                    index:       String(idx + 1),
                    description: m.description ? String(m.description.value) : "—",
                    quantity:    m.quantity    ? String(m.quantity.value)    : "—",
                    unitPrice:   m.unitPrice   ? String(m.unitPrice.value)   : "—",
                    netAmount:   m.netAmount   ? String(m.netAmount.value)   : "—",
                    taxAmount:   m.taxAmount   ? String(m.taxAmount.value)   : "—"
                };
            });

            oViewModel.setProperty("/lineItems",     lineItems);
            oViewModel.setProperty("/lineItemCount", String(lineItems.length));
        },

        // ── Clear results ─────────────────────────────────────────────
        _clearResults: function (oViewModel) {
            oViewModel.setProperty("/docFileName",    "");
            oViewModel.setProperty("/docNumber",      "");
            oViewModel.setProperty("/docDate",        "");
            oViewModel.setProperty("/docType",        "");
            oViewModel.setProperty("/docStatus",      "");
            oViewModel.setProperty("/docPages",       "");
            oViewModel.setProperty("/docLanguage",    "");
            oViewModel.setProperty("/docSender",      "");
            oViewModel.setProperty("/docReceiver",    "");
            oViewModel.setProperty("/docGrossAmount", "");
            oViewModel.setProperty("/docNetAmount",   "");
            oViewModel.setProperty("/docTaxAmount",   "");
            oViewModel.setProperty("/docCurrency",    "");
            oViewModel.setProperty("/headerFields",     []);
            oViewModel.setProperty("/headerFieldCount", "");
            oViewModel.setProperty("/lineItems",        []);
            oViewModel.setProperty("/lineItemCount",    "");
        },

        // ── Copy JSON to clipboard ────────────────────────────────────
        onCopyJson: function () {
            var json = this.getView().getModel("appView").getProperty("/extractedData");
            if (!json) return;
            navigator.clipboard.writeText(json).then(function () {
                MessageToast.show("JSON copied to clipboard!");
            });
        },

        // ── Clear results button ──────────────────────────────────────
        onClearResults: function () {
            var oViewModel = this.getView().getModel("appView");
            this._clearResults(oViewModel);
            oViewModel.setProperty("/extractedData",  "");
            oViewModel.setProperty("/statusMessage",  "");
        },

        // ── Search header fields table ────────────────────────────────
        onSearchFields: function (oEvent) {
            var sQuery = oEvent.getParameter("newValue").toLowerCase();
            var oTable = this.byId("headerFieldsTable");
            var oBinding = oTable.getBinding("items");
            if (!oBinding) return;

            if (!sQuery) {
                oBinding.filter([]);
                return;
            }

            var oFilter = new sap.ui.model.Filter({
                filters: [
                    new sap.ui.model.Filter("label", sap.ui.model.FilterOperator.Contains, sQuery),
                    new sap.ui.model.Filter("value", sap.ui.model.FilterOperator.Contains, sQuery),
                    new sap.ui.model.Filter("category", sap.ui.model.FilterOperator.Contains, sQuery)
                ],
                and: false
            });
            oBinding.filter([oFilter]);
        }
    });
});