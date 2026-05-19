namespace com.sap.docai;

entity ExtractionHistory {
  key ID            : UUID;
      fileName      : String(255);
      documentType  : String(50);
      status        : String(20);
      extractedData : LargeString;
      grossAmount   : String(50);
      currency      : String(10);
      senderName    : String(255);
      receiverName  : String(255);
      documentNumber: String(100);
      documentDate  : String(50);
      pageCount     : Integer;
      createdAt     : Timestamp;
}
