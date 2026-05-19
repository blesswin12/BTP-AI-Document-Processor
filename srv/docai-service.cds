using com.sap.docai as docai from '../db/docai-schema';

service DocAIService @(path: '/odata/v4/docai') {
    entity ExtractionHistory as projection on docai.ExtractionHistory;
}
