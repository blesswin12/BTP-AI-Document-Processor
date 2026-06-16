# BTP-AI-Document-Processor

An enterprise-grade intelligent document processing solution built with the SAP Cloud Application Programming Model (CAP) and SAPUI5 (Fiori). The application leverages SAP BTP Document Information Extraction (DIEx) AI services to automatically analyze unstructured PDF documents and transform them into structured, searchable, and business-ready data.

Organizations often spend significant time manually extracting information from invoices, purchase orders, bank statements, and payment advices. This application streamlines that process by using AI-powered document understanding capabilities provided by SAP BTP, reducing manual effort, improving accuracy, and accelerating document-driven business workflows.

## Business Value

* Eliminate manual data entry from business documents.
* Improve operational efficiency and processing speed.
* Reduce human errors through AI-assisted extraction.
* Enable quick access to structured financial and procurement data.
* Maintain a complete audit trail of processed documents.
* Easily integrate extracted data with SAP and non-SAP business applications.

## Key Features

### Intelligent Document Processing

Upload PDF documents and automatically extract relevant business information using SAP BTP Document Information Extraction (DIEx) services.

### Multi-Document Type Support

The application supports multiple business document categories:

* Invoices
* Purchase Orders
* Payment Advices
* Bank Statements

Each document type is processed using the appropriate AI model to ensure accurate field recognition and extraction.

### Secure SAP BTP Integration

* OAuth2 authentication using SAP BTP XSUAA/UAA services
* Secure API communication with SAP AI services
* Enterprise-ready architecture following SAP best practices

### Asynchronous Processing Workflow

Large documents are processed asynchronously:

1. Upload document
2. Submit extraction request
3. Poll processing status
4. Retrieve AI-generated results
5. Display structured output

This approach ensures scalability and a responsive user experience.

### Smart Data Validation

The application automatically:

* Removes duplicate field values
* Retains high-confidence extraction results
* Highlights low-confidence fields for manual verification
* Sorts extracted information based on confidence scores

### Line Item Extraction

Supports extraction of repeating tabular data such as:

* Product descriptions
* Item quantities
* Unit prices
* Tax amounts
* Net values
* Total amounts

Extracted line items are displayed in structured and user-friendly tables.

### Advanced Search & Filtering

Users can quickly locate extracted information through:

* Real-time search
* Dynamic filtering
* Field-based lookup capabilities

### Extraction History & Audit Trail

Every document processing request is logged through OData V4 services.

Stored information includes:

* Document metadata
* Extraction timestamps
* AI response payloads
* Processing status
* Extracted business fields

This provides complete traceability and auditing capabilities.

## Architecture

### Frontend

Built using SAPUI5 and SAP Fiori design principles.

* XML Views
* MVC Architecture
* JSON Models
* SAP Horizon Theme
* Responsive UI Design

### Backend

Built using SAP CAP (Node.js).

Responsibilities include:

* File upload handling
* Authentication management
* DIEx API integration
* Result transformation
* OData service exposure
* Persistence layer management

### Database

* SQLite for local development
* SAP HANA Cloud for production environments

### Deployment

Designed for SAP BTP Cloud Foundry deployment using Multi-Target Applications (MTA).

## Technology Stack

### Frontend

* SAPUI5
* SAP Fiori
* XML Views
* JSONModel

### Backend

* SAP CAP (Node.js)
* Express.js
* Axios
* Multer

### AI Services

* SAP BTP Document Information Extraction (DIEx)

### Database

* SQLite
* SAP HANA Cloud

### Platform

* SAP Business Technology Platform (BTP)
* Cloud Foundry
* MTA Deployment

## Getting Started

### Prerequisites

* Node.js
* SAP CAP CLI
* SAP BTP Account
* Document Information Extraction Service Instance

### Installation

Clone the repository:

```bash
git clone <repository-url>
cd BTP-AI-Document-Processor
```

Install dependencies:

```bash
npm install
```

Configure environment variables:

```bash
cp env.example.json default-env.json
```

Update `default-env.json` with your SAP BTP DIEx service credentials.

Start the application:

```bash
cds watch
```

Open the application:

```text
http://localhost:4004
```

## Future Enhancements

* Custom document template training
* OCR support for scanned documents
* Multi-language document processing
* SAP S/4HANA integration
* Workflow approvals using SAP Build Process Automation
* Export extracted data to Excel and PDF
* AI-assisted validation and correction suggestions

## Use Cases

* Accounts Payable Automation
* Invoice Processing
* Procurement Document Analysis
* Financial Statement Digitization
* Vendor Document Management
* Banking and Payment Reconciliation

## License

This project is intended for learning, experimentation, and enterprise integration scenarios on SAP Business Technology Platform (BTP).
