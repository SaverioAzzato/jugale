use serde::Serialize;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DownloadRequest {
    pub url: String,
    pub file_name: String,
    pub expected_size: u64,
    pub expected_digest: Option<String>,
}
