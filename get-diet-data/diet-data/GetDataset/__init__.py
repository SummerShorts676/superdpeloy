# import logging
# import os
# import azure.functions as func
# from azure.storage.blob import BlobServiceClient
# from dotenv import load_dotenv

# # Load environment variables from a local .env file (if present).
# # This makes os.getenv(...) pick up values during local development.
# load_dotenv()

# # If using Managed Identity, use DefaultAzureCredential (from azure.identity)
# # For quick dev with connection string, use AZURE_STORAGE_CONNECTION_STRING env var.

# USE_MANAGED_IDENTITY = os.getenv("USE_MANAGED_IDENTITY", "false").lower() == "true"

# if USE_MANAGED_IDENTITY:
#     from azure.identity import DefaultAzureCredential
#     credential = DefaultAzureCredential()
#     blob_service_client = BlobServiceClient(
#         account_url=f"https://{os.getenv('STORAGE_ACCOUNT_NAME')}.blob.core.windows.net",
#         credential=credential
#     )
# else:
#     conn_str = os.getenv("AZURE_STORAGE_CONNECTION_STRING")
#     blob_service_client = BlobServiceClient.from_connection_string(conn_str)

# def main(req: func.HttpRequest) -> func.HttpResponse:
#     logging.info("GetDataset function processed a request.")

#     container = "diet-data"
#     blob_name = "All_Diets.csv"

#     try:
#         container_client = blob_service_client.get_container_client(container)
#         blob_client = container_client.get_blob_client(blob_name)

#         stream = blob_client.download_blob()
#         data = stream.readall()

#         # Return raw JSON/text; adjust headers for CORS on the function app (see later)
#         return func.HttpResponse(body=data, status_code=200, mimetype="application/json")

#     except Exception as e:
#         logging.exception("Error fetching blob")
#         return func.HttpResponse(f"Error: {str(e)}", status_code=500)
