import azure.functions as func
import datetime
import json
import logging
import io
import csv
import os
import azure.functions as func
from azure.storage.blob import BlobServiceClient
from dotenv import load_dotenv

# Load environment variables from a local .env file (if present).
# This makes os.getenv(...) pick up values during local development.
load_dotenv()

# If using Managed Identity, use DefaultAzureCredential (from azure.identity)
# For quick dev with connection string, use AZURE_STORAGE_CONNECTION_STRING env var.

USE_MANAGED_IDENTITY = os.getenv("USE_MANAGED_IDENTITY", "false").lower() == "true"

# Create BlobServiceClient lazily to avoid raising exceptions at import time which
# can prevent the Functions host from starting when environment variables are
# missing in the deployment environment. This also keeps cold-start fast when
# the client is only needed for certain routes.
blob_service_client = None


def get_blob_service_client():
    """Return a cached BlobServiceClient or create one. Returns None if unable
    to create (for example when AZURE_STORAGE_CONNECTION_STRING is not set).
    """
    global blob_service_client
    if blob_service_client:
        return blob_service_client
    try:
        if USE_MANAGED_IDENTITY:
            # Import lazily so missing azure.identity in some environments doesn't
            # break the module import.
            from azure.identity import DefaultAzureCredential

            credential = DefaultAzureCredential()
            blob_service_client = BlobServiceClient(
                account_url=f"https://{os.getenv('STORAGE_ACCOUNT_NAME')}.blob.core.windows.net",
                credential=credential,
            )
        else:
            conn_str = os.getenv("AZURE_STORAGE_CONNECTION_STRING")
            if not conn_str:
                # Caller should handle a None return value and respond appropriately.
                return None
            blob_service_client = BlobServiceClient.from_connection_string(conn_str)
        return blob_service_client
    except Exception:
        logging.exception("Failed to initialize BlobServiceClient")
        return None


app = func.FunctionApp()

# CORS headers to allow browser clients (adjust origin as needed for production)
CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
}

@app.route(route="GetDataset", auth_level=func.AuthLevel.ANONYMOUS)
def GetDataset(req: func.HttpRequest) -> func.HttpResponse:
    logging.info('Python HTTP trigger function processed a request.')

    # Handle CORS preflight
    if req.method == "OPTIONS":
        return func.HttpResponse(status_code=204, headers=CORS_HEADERS)

    name = req.params.get('name')
    if not name:
        try:
            req_body = req.get_json()
        except ValueError:
            pass
        else:
            name = req_body.get('name')

    if name:
        return func.HttpResponse(
            f"Hello, {name}. This HTTP triggered function executed successfully.",
            status_code=200,
            headers=CORS_HEADERS,
        )
    else:
        return func.HttpResponse(
            "This HTTP triggered function executed successfully. Pass a name in the query string or in the request body for a personalized response.",
            status_code=200,
            headers=CORS_HEADERS,
        )

import logging

@app.route(route="FetchDataset", auth_level=func.AuthLevel.ANONYMOUS)
def detDiet(req: func.HttpRequest) -> func.HttpResponse:
    logging.info("GetDataset function processed a request.")

    # Handle CORS preflight
    if req.method == "OPTIONS":
        return func.HttpResponse(status_code=204, headers=CORS_HEADERS)

    container = "diet-data"
    blob_name = "All_Diets.csv"

    try:
        bsc = get_blob_service_client()
        if not bsc:
            # Return a clear error if storage is not configured in the environment.
            logging.error("BlobServiceClient not configured; check AZURE_STORAGE_CONNECTION_STRING or USE_MANAGED_IDENTITY setting")
            return func.HttpResponse(
                "Storage is not configured. Please set AZURE_STORAGE_CONNECTION_STRING or enable managed identity (USE_MANAGED_IDENTITY=true).",
                status_code=500,
                headers=CORS_HEADERS,
            )

        container_client = bsc.get_container_client(container)
        blob_client = container_client.get_blob_client(blob_name)

        stream = blob_client.download_blob()
        data = stream.readall()

        # The blob is a CSV. Convert to JSON so the front-end can call response.json().
        try:
            text = data.decode('utf-8')
        except Exception:
            # Fallback: try latin-1
            text = data.decode('latin-1')

        csv_file = io.StringIO(text)
        reader = csv.DictReader(csv_file)
        rows = [r for r in reader]

        json_body = json.dumps(rows)

        return func.HttpResponse(body=json_body, status_code=200, mimetype="application/json", headers=CORS_HEADERS)

    except Exception as e:
        logging.exception("Error fetching blob")
        return func.HttpResponse(f"Error: {str(e)}", status_code=500, headers=CORS_HEADERS)
