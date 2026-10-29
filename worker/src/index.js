const AUTH_SERVICE_URL =
  "https://auth-service.adel-euai.workers.dev";

const PROJECT = "asset-hub";

const JSON_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store"
};

const ASSET_TYPES = {
  banner: {
    label: "Banner",
    folder: "banner",
    filename: "banner"
  },

  cover: {
    label: "Cover",
    folder: "cover",
    filename: "cover"
  },

  logo: {
    label: "Logo",
    folder: "logo",
    filename: "logo"
  },

  "og-image": {
    label: "OG Image",
    folder: "og-image",
    filename: "og-image"
  }
};

const SLOT_TYPES = {
  screenshot: {
    label: "Screenshot",
    folder: "screenshot",
    max: 9
  },

  "sub-logo": {
    label: "Sub Logo",
    folder: "sub-logo",
    max: 99
  }
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(request)
      });
    }

    if (
      url.pathname === "/auth/login" &&
      request.method === "POST"
    ) {
      try {
        return await authLogin(request);
      } catch (error) {
        console.error(error);

        return json(
          {
            error:
              error?.message ||
              "Authentication failed"
          },
          error.status || 500,
          request
        );
      }
    }

    if (
      url.pathname === "/auth/validate" &&
      request.method === "POST"
    ) {
      try {
        const result =
          await validateSession(request);

        return new Response(
          JSON.stringify(result.data),
          {
            status: result.response.status,
            headers: {
              ...JSON_HEADERS,
              ...corsHeaders(request)
            }
          }
        );
      } catch (error) {
        console.error(error);

        return json(
          {
            authenticated: false,
            error:
              error?.message ||
              "Validation failed"
          },
          error.status || 500,
          request
        );
      }
    }

    if (url.pathname.startsWith("/api/")) {
      try {
        return await api(
          request,
          env,
          url
        );
      } catch (error) {
        console.error(error);

        return json(
          {
            error:
              error?.message ||
              "Internal server error"
          },
          error.status || 500,
          request
        );
      }
    }

    return new Response("Not Found", {
      status: 404,
      headers: {
        "Content-Type":
          "text/plain; charset=utf-8",
        ...corsHeaders(request)
      }
    });
  }
};


/* =========================================================
   API
========================================================= */

async function api(request, env, url) {
  const session =
    await requireSession(request);

  if (
    url.pathname === "/api/auth/me" &&
    request.method === "GET"
  ) {
    return json(
      {
        authenticated: true,
        user: session.user ?? null
      },
      200,
      request
    );
  }

  if (
    url.pathname === "/api/projects" &&
    request.method === "GET"
  ) {
    return json(
      await listProjects(env),
      200,
      request
    );
  }

  if (
    url.pathname === "/api/projects" &&
    request.method === "POST"
  ) {
    let body;

    try {
      body =
        await request.json();
    } catch {
      throw httpError(
        "Invalid JSON body",
        400
      );
    }

    return json(
      await createProject(
        env,
        body
      ),
      201,
      request
    );
  }

  const projectMatch =
    url.pathname.match(
      /^\/api\/projects\/([^/]+)$/
    );

  if (projectMatch) {
    const projectId =
      decodeURIComponent(
        projectMatch[1]
      );

    if (request.method === "GET") {
      return json(
        await getProject(
          env,
          projectId
        ),
        200,
        request
      );
    }

    if (request.method === "PATCH") {
      let body;

      try {
        body =
          await request.json();
      } catch {
        throw httpError(
          "Invalid JSON body",
          400
        );
      }

      return json(
        await renameProject(
          env,
          projectId,
          body
        ),
        200,
        request
      );
    }

    if (request.method === "DELETE") {
      return json(
        await deleteProject(
          env,
          projectId
        ),
        200,
        request
      );
    }
  }

  const assetMatch =
    url.pathname.match(
      /^\/api\/projects\/([^/]+)\/assets\/([^/]+)$/
    );

  if (assetMatch) {
    const projectId =
      decodeURIComponent(
        assetMatch[1]
      );

    const assetType =
      decodeURIComponent(
        assetMatch[2]
      );

    if (request.method === "POST") {
      return json(
        await uploadAsset(
          request,
          env,
          projectId,
          assetType
        ),
        200,
        request
      );
    }

    if (request.method === "DELETE") {
      return json(
        await deleteCurrentAsset(
          env,
          projectId,
          assetType
        ),
        200,
        request
      );
    }
  }

  const fileMatch =
    url.pathname.match(
      /^\/api\/projects\/([^/]+)\/assets\/([^/]+)\/file$/
    );

  if (
    fileMatch &&
    request.method === "GET"
  ) {
    const projectId =
      decodeURIComponent(
        fileMatch[1]
      );

    const assetType =
      decodeURIComponent(
        fileMatch[2]
      );

    return await serveCurrentAsset(
      env,
      projectId,
      assetType,
      request
    );
  }

  return json(
    {
      error: "Not found"
    },
    404,
    request
  );
}


/* =========================================================
   AUTH
========================================================= */

async function authLogin(request) {
  let body;

  try {
    body =
      await request.json();
  } catch {
    return json(
      {
        ok: false,
        error:
          "Invalid JSON body."
      },
      400,
      request
    );
  }

  const username =
    typeof body?.username === "string"
      ? body.username.trim()
      : "";

  const password =
    typeof body?.password === "string"
      ? body.password
      : "";

  if (!username || !password) {
    return json(
      {
        ok: false,
        error:
          "Username and password are required."
      },
      400,
      request
    );
  }

  try {
    const response =
      await fetch(
        `${AUTH_SERVICE_URL}/auth/login`,
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json"
          },
          body: JSON.stringify({
            project: PROJECT,
            username,
            password
          })
        }
      );

    const text =
      await response.text();

    let data = {};

    try {
      data =
        JSON.parse(text);
    } catch {
      data = {
        ok: false,
        error:
          text ||
          "Authentication service error."
      };
    }

    if (!response.ok) {
      return json(
        {
          ok: false,
          error:
            data?.error ||
            "Authentication service rejected the login.",
          upstreamStatus:
            response.status
        },
        response.status,
        request
      );
    }

    return json(
      data,
      response.status,
      request
    );
  } catch (error) {
    console.error(
      "Auth Service login error:",
      error
    );

    return json(
      {
        ok: false,
        error:
          "Authentication service unavailable."
      },
      502,
      request
    );
  }
}

async function validateSession(request) {
  let body;

  try {
    body =
      await request.json();
  } catch {
    return {
      response:
        new Response(null, {
          status: 400
        }),

      data: {
        authenticated: false,
        error:
          "Invalid JSON body."
      }
    };
  }

  const sessionToken =
    typeof body?.sessionToken === "string"
      ? body.sessionToken.trim()
      : "";

  if (!sessionToken) {
    return {
      response:
        new Response(null, {
          status: 400
        }),

      data: {
        authenticated: false,
        error:
          "Session token is required."
      }
    };
  }

  return validateSessionToken(
    sessionToken
  );
}

async function validateSessionToken(
  sessionToken
) {
  try {
    const response =
      await fetch(
        `${AUTH_SERVICE_URL}/auth/validate`,
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json"
          },
          body: JSON.stringify({
            project: PROJECT,
            sessionToken
          })
        }
      );

    const text =
      await response.text();

    let data = {};

    try {
      data =
        JSON.parse(text);
    } catch {
      data = {
        authenticated: false,
        error:
          text ||
          "Authentication service error."
      };
    }

    return {
      response,
      data
    };
  } catch (error) {
    console.error(
      "Auth Service validation error:",
      error
    );

    return {
      response:
        new Response(null, {
          status: 502
        }),

      data: {
        authenticated: false,
        error:
          "Authentication service unavailable."
      }
    };
  }
}

async function requireSession(request) {
  const auth =
    request.headers.get(
      "Authorization"
    ) || "";

  const sessionToken =
    auth.startsWith("Bearer ")
      ? auth.slice(7).trim()
      : "";

  if (!sessionToken) {
    throw httpError(
      "Authentication required",
      401
    );
  }

  const result =
    await validateSessionToken(
      sessionToken
    );

  if (
    !result.response.ok ||
    result.data.authenticated !== true
  ) {
    throw httpError(
      "Invalid or expired session",
      401
    );
  }

  return result.data;
}


/* =========================================================
   ASSET TYPES
========================================================= */

function parseAssetType(assetType) {
  const value =
    String(assetType || "")
      .trim()
      .toLowerCase();

  if (ASSET_TYPES[value]) {
    return {
      key: value,
      ...ASSET_TYPES[value],
      slot: null
    };
  }

  const match =
    value.match(
      /^(screenshot|sub-logo)-(\d+)$/
    );

  if (!match) {
    throw httpError(
      "Invalid asset type",
      400
    );
  }

  const family =
    match[1];

  const slot =
    Number(match[2]);

  const spec =
    SLOT_TYPES[family];

  if (
    !Number.isInteger(slot) ||
    slot < 1 ||
    slot > spec.max
  ) {
    throw httpError(
      `Invalid ${spec.label} slot`,
      400
    );
  }

  return {
    key: value,
    ...spec,
    slot
  };
}

function validateAssetType(type) {
  return parseAssetType(type);
}

function getImageExtension(file) {
  const filename =
    String(file?.name || "")
      .trim()
      .toLowerCase();

  const match =
    filename.match(
      /\.([a-z0-9]+)$/
    );

  if (match) {
    const extension =
      match[1];

    const allowed = [
      "png",
      "jpg",
      "jpeg",
      "webp",
      "gif",
      "avif"
    ];

    if (
      allowed.includes(
        extension
      )
    ) {
      return extension;
    }
  }

  const contentType =
    String(
      file?.type || ""
    ).toLowerCase();

  const contentTypeMap = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/webp": "webp",
    "image/gif": "gif",
    "image/avif": "avif"
  };

  return (
    contentTypeMap[
      contentType
    ] || null
  );
}


/* =========================================================
   ASSET PATHS
========================================================= */

function assetPath(
  projectId,
  spec,
  extension = "png"
) {
  const filename =
    spec.slot
      ? `${spec.slot}.${extension}`
      : `${spec.filename}.${extension}`;

  if (spec.slot) {
    return (
      `projects/${projectId}/` +
      `${spec.folder}/${filename}`
    );
  }

  return (
    `projects/${projectId}/` +
    `${filename}`
  );
}

async function findCurrentAssetFile(
  env,
  projectId,
  assetType,
  currentFilename = null
) {
  const spec =
    validateAssetType(
      assetType
    );

  const path =
    spec.slot
      ? `projects/${projectId}/${spec.folder}`
      : `projects/${projectId}`;

  const entries =
    await githubGet(
      env,
      path
    );

  if (!Array.isArray(entries)) {
    return null;
  }

  if (currentFilename) {
    const exact =
      entries.find(
        entry =>
          entry.type === "file" &&
          entry.name ===
            currentFilename
      );

    if (exact) {
      return exact;
    }
  }

  const prefix =
    spec.slot
      ? `${spec.slot}.`
      : `${spec.filename}.`;

  return (
    entries.find(
      entry =>
        entry.type === "file" &&
        entry.name.startsWith(
          prefix
        )
    ) || null
  );
}


/* =========================================================
   PROJECTS
========================================================= */

function slugify(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(
      /[^a-z0-9]+/g,
      "-"
    )
    .replace(
      /^-+|-+$/g,
      ""
    )
    .slice(0, 80);
}

function safeProjectId(value) {
  const id =
    slugify(value);

  if (!id) {
    throw httpError(
      "Invalid project id",
      400
    );
  }

  return id;
}

async function listProjects(env) {
  const registry =
    await readRegistry(env);

  const projects =
    Object.values(
      registry.projects || {}
    ).map(project => ({
      id: project.id,
      name: project.name,
      createdAt:
        project.createdAt,
      assets:
        project.assets || {}
    }));

  return {
    projects
  };
}

async function getProject(
  env,
  projectId
) {
  const id =
    safeProjectId(
      projectId
    );

  const registry =
    await readRegistry(env);

  const project =
    registry.projects?.[id];

  if (!project) {
    throw httpError(
      "Project not found",
      404
    );
  }

  return {
    project
  };
}

async function createProject(
  env,
  body
) {
  const name =
    String(
      body?.name || ""
    ).trim();

  const requestedId =
    String(
      body?.id || ""
    ).trim();

  if (!name) {
    throw httpError(
      "Project name is required",
      400
    );
  }

  const id =
    safeProjectId(
      requestedId || name
    );

  const registry =
    await readRegistry(env);

  if (
    registry.projects?.[id]
  ) {
    throw httpError(
      "Project already exists",
      409
    );
  }

  registry.projects =
    registry.projects || {};

  registry.projects[id] = {
    id,
    name,

    createdAt:
      new Date().toISOString(),

    assets: {
      banner: null,
      cover: null,
      logo: null,
      "og-image": null,
      screenshots: {},
      "sub-logos": {}
    }
  };

  await writeRegistry(
    env,
    registry,
    registry._sha
  );

  return {
    project:
      registry.projects[id]
  };
}

async function renameProject(
  env,
  projectId,
  body
) {
  const id =
    safeProjectId(
      projectId
    );

  const name =
    String(
      body?.name || ""
    ).trim();

  if (!name) {
    throw httpError(
      "Project name is required",
      400
    );
  }

  const registry =
    await readRegistry(env);

  const project =
    registry.projects?.[id];

  if (!project) {
    throw httpError(
      "Project not found",
      404
    );
  }

  project.name =
    name;

  await writeRegistry(
    env,
    registry,
    registry._sha
  );

  return {
    project
  };
}

async function deleteProject(
  env,
  projectId
) {
  const id =
    safeProjectId(
      projectId
    );

  const registry =
    await readRegistry(env);

  const project =
    registry.projects?.[id];

  if (!project) {
    throw httpError(
      "Project not found",
      404
    );
  }

  await deleteGitHubDirectory(
    env,
    `projects/${id}`
  );

  delete registry.projects[id];

  await writeRegistry(
    env,
    registry,
    registry._sha
  );

  return {
    project: id,
    deleted: true
  };
}

async function deleteGitHubDirectory(
  env,
  path
) {
  const entries =
    await githubGet(
      env,
      path
    );

  if (!Array.isArray(entries)) {
    return;
  }

  for (const entry of entries) {
    if (
      entry.type === "dir"
    ) {
      await deleteGitHubDirectory(
        env,
        entry.path
      );

      continue;
    }

    if (
      entry.type === "file"
    ) {
      await githubDelete(
        env,
        entry.path,
        "Delete project file",
        entry.sha
      );
    }
  }
}


/* =========================================================
   ASSETS
========================================================= */

async function uploadAsset(
  request,
  env,
  projectId,
  assetType
) {
  const id =
    safeProjectId(
      projectId
    );

  const spec =
    validateAssetType(
      assetType
    );

  const registry =
    await readRegistry(env);

  const project =
    registry.projects?.[id];

  if (!project) {
    throw httpError(
      "Project not found",
      404
    );
  }

  const form =
    await request.formData();

  const file =
    form.get("file");

  if (!(file instanceof File)) {
    throw httpError(
      "File is required",
      400
    );
  }

  const extension =
    getImageExtension(file);

  if (!extension) {
    throw httpError(
      "Unsupported image format",
      400
    );
  }

  const bytes =
    await file.arrayBuffer();

  const current =
    await findCurrentAssetFile(
      env,
      id,
      assetType
    );

  const currentExtension =
    current?.name
      ?.split(".")
      .pop()
      ?.toLowerCase();

  /*
   * Replacement keeps the existing
   * extension so the public URL
   * remains stable.
   */
  if (
    current &&
    currentExtension !==
      extension
  ) {
    throw httpError(
      `Replacement file must keep the existing .${currentExtension} format`,
      400
    );
  }

  const path =
    assetPath(
      id,
      spec,
      currentExtension ||
        extension
    );

  const currentFile =
    await githubGet(
      env,
      path
    );

  await githubPut(
    env,
    path,
    arrayBufferToBase64(
      bytes
    ),
    `Update ${spec.label}`,
    currentFile?.sha
  );

  const asset = {
    filename:
      path.split("/").pop(),

    contentType:
      file.type ||
      getContentTypeFromFilename(
        path
      ),

    extension,

    updatedAt:
      new Date().toISOString()
  };

  project.assets =
    project.assets || {};

  if (spec.slot) {
    const collection =
      spec.key.startsWith(
        "screenshot-"
      )
        ? "screenshots"
        : "sub-logos";

    project.assets[
      collection
    ] =
      project.assets[
        collection
      ] || {};

    project.assets[
      collection
    ][
      String(spec.slot)
    ] = asset;
  } else {
    project.assets[
      spec.key
    ] = asset;
  }

  await writeRegistry(
    env,
    registry,
    registry._sha
  );

  return {
    project,
    assetType:
      spec.key
  };
}

async function deleteCurrentAsset(
  env,
  projectId,
  assetType
) {
  const id =
    safeProjectId(
      projectId
    );

  const spec =
    validateAssetType(
      assetType
    );

  const registry =
    await readRegistry(env);

  const project =
    registry.projects?.[id];

  if (!project) {
    throw httpError(
      "Project not found",
      404
    );
  }

  let current;

  if (spec.slot) {
    const collection =
      spec.key.startsWith(
        "screenshot-"
      )
        ? "screenshots"
        : "sub-logos";

    current =
      project.assets?.[
        collection
      ]?.[
        String(spec.slot)
      ];
  } else {
    current =
      project.assets?.[
        spec.key
      ];
  }

  if (!current) {
    throw httpError(
      "Current asset not found",
      404
    );
  }

  const currentFile =
    await findCurrentAssetFile(
      env,
      id,
      assetType,
      current.filename
    );

  if (!currentFile) {
    throw httpError(
      "Current asset file not found",
      404
    );
  }

  await githubDelete(
    env,
    currentFile.path,
    `Delete current ${spec.label}`,
    currentFile.sha
  );

  if (spec.slot) {
    const collection =
      spec.key.startsWith(
        "screenshot-"
      )
        ? "screenshots"
        : "sub-logos";

    delete project.assets[
      collection
    ][
      String(spec.slot)
    ];
  } else {
    project.assets[
      spec.key
    ] = null;
  }

  await writeRegistry(
    env,
    registry,
    registry._sha
  );

  return {
    project: id,
    assetType:
      spec.key,
    deleted: true
  };
}

async function serveCurrentAsset(
  env,
  projectId,
  assetType,
  request
) {
  const id =
    safeProjectId(
      projectId
    );

  const spec =
    validateAssetType(
      assetType
    );

  const registry =
    await readRegistry(env);

  const project =
    registry.projects?.[id];

  if (!project) {
    throw httpError(
      "Project not found",
      404
    );
  }

  let current;

  if (spec.slot) {
    const collection =
      spec.key.startsWith(
        "screenshot-"
      )
        ? "screenshots"
        : "sub-logos";

    current =
      project.assets?.[
        collection
      ]?.[
        String(spec.slot)
      ];
  } else {
    current =
      project.assets?.[
        spec.key
      ];
  }

  if (!current) {
    throw httpError(
      "Current asset not found",
      404
    );
  }

  let filePath;

  if (spec.slot) {
    const extension =
      String(
        current.filename ||
          "png"
      )
        .split(".")
        .pop()
        .toLowerCase();

    filePath =
      `projects/${id}/` +
      `${spec.folder}/` +
      `${spec.slot}.${extension}`;
  } else {
    const currentFile =
      await findCurrentAssetFile(
        env,
        id,
        assetType,
        current.filename
      );

    if (!currentFile) {
      throw httpError(
        "Current asset file not found",
        404
      );
    }

    filePath =
      currentFile.path;
  }

  const bytes =
    await githubGetRaw(
      env,
      filePath
    );

  if (!bytes) {
    throw httpError(
      `Current asset not found: ${filePath}`,
      404
    );
  }

  return new Response(
    bytes,
    {
      status: 200,

      headers: {
        "Content-Type":
          current.contentType ||
          getContentTypeFromFilename(
            filePath
          ),

        "Cache-Control":
          "private, no-store",

        ...corsHeaders(request)
      }
    }
  );
}


/* =========================================================
   GITHUB
========================================================= */

function repoPath(env, path) {
  return (
    `https://api.github.com/repos/` +
    `${env.GITHUB_OWNER}/` +
    `${env.GITHUB_REPO}/contents/` +
    `${path}`
  );
}

function githubHeaders(
  env,
  extra = {}
) {
  if (!env.GITHUB_TOKEN) {
    throw new Error(
      "GITHUB_TOKEN is not configured"
    );
  }

  return {
    Accept:
      "application/vnd.github+json",

    Authorization:
      `Bearer ${env.GITHUB_TOKEN}`,

    "X-GitHub-Api-Version":
      "2022-11-28",

    "User-Agent":
      "Adel-Asset-Hub",

    ...extra
  };
}

async function githubGet(
  env,
  path
) {
  const response =
    await fetch(
      repoPath(
        env,
        path
      ),
      {
        headers:
          githubHeaders(env)
      }
    );

  if (
    response.status === 404
  ) {
    return null;
  }

  if (!response.ok) {
    const detail =
      await response.text();

    throw new Error(
      `GitHub GET failed: ${response.status} ${detail}`
    );
  }

  return response.json();
}

async function githubGetRaw(
  env,
  path
) {
  const response =
    await fetch(
      repoPath(
        env,
        path
      ),
      {
        headers:
          githubHeaders(
            env,
            {
              Accept:
                "application/vnd.github.raw"
            }
          )
      }
    );

  if (
    response.status === 404
  ) {
    return null;
  }

  if (!response.ok) {
    const detail =
      await response.text();

    throw new Error(
      `GitHub RAW GET failed: ${response.status} ${detail}`
    );
  }

  return new Uint8Array(
    await response.arrayBuffer()
  );
}

async function githubPut(
  env,
  path,
  contentBase64,
  message,
  sha = undefined
) {
  const body = {
    message,
    content:
      contentBase64
  };

  if (sha) {
    body.sha = sha;
  }

  const response =
    await fetch(
      repoPath(
        env,
        path
      ),
      {
        method: "PUT",

        headers:
          githubHeaders(
            env,
            {
              "Content-Type":
                "application/json"
            }
          ),

        body:
          JSON.stringify(body)
      }
    );

  if (!response.ok) {
    const detail =
      await response.text();

    throw new Error(
      `GitHub PUT failed: ${response.status} ${detail}`
    );
  }

  return response.json();
}

async function githubDelete(
  env,
  path,
  message,
  sha
) {
  const response =
    await fetch(
      repoPath(
        env,
        path
      ),
      {
        method: "DELETE",

        headers:
          githubHeaders(
            env,
            {
              "Content-Type":
                "application/json"
            }
          ),

        body:
          JSON.stringify({
            message,
            sha
          })
      }
    );

  if (!response.ok) {
    const detail =
      await response.text();

    throw new Error(
      `GitHub DELETE failed: ${response.status} ${detail}`
    );
  }

  return response.json();
}


/* =========================================================
   REGISTRY
========================================================= */

async function readRegistry(env) {
  const file =
    await githubGet(
      env,
      "registry.json"
    );

  if (!file) {
    return {
      version: 1,
      projects: {}
    };
  }

  const decoded =
    decodeBase64(
      file.content
    );

  const data =
    JSON.parse(decoded);

  data._sha =
    file.sha;

  return data;
}

async function writeRegistry(
  env,
  registry,
  sha
) {
  const clean = {
    ...registry
  };

  delete clean._sha;

  const content =
    encodeBase64(
      JSON.stringify(
        clean,
        null,
        2
      ) + "\n"
    );

  await githubPut(
    env,
    "registry.json",
    content,
    "Update Asset Hub metadata",
    sha
  );
}


/* =========================================================
   CONTENT TYPES
========================================================= */

function getContentTypeFromFilename(
  filename
) {
  const extension =
    String(filename || "")
      .split(".")
      .pop()
      .toLowerCase();

  const contentTypeMap = {
    png:
      "image/png",

    jpg:
      "image/jpeg",

    jpeg:
      "image/jpeg",

    webp:
      "image/webp",

    gif:
      "image/gif",

    avif:
      "image/avif",

    txt:
      "text/plain; charset=utf-8"
  };

  return (
    contentTypeMap[
      extension
    ] ||
    "application/octet-stream"
  );
}


/* =========================================================
   BASE64
========================================================= */

function decodeBase64(
  value
) {
  const binary =
    atob(
      value.replace(
        /\n/g,
        ""
      )
    );

  const bytes =
    Uint8Array.from(
      binary,
      c =>
        c.charCodeAt(0)
    );

  return new TextDecoder()
    .decode(bytes);
}

function encodeBase64(
  value
) {
  const bytes =
    new TextEncoder()
      .encode(value);

  return arrayBufferToBase64(
    bytes
  );
}

function arrayBufferToBase64(
  buffer
) {
  const bytes =
    buffer instanceof Uint8Array
      ? buffer
      : new Uint8Array(buffer);

  let binary = "";

  const chunk =
    0x8000;

  for (
    let i = 0;
    i < bytes.length;
    i += chunk
  ) {
    binary +=
      String.fromCharCode(
        ...bytes.subarray(
          i,
          i + chunk
        )
      );
  }

  return btoa(binary);
}


/* =========================================================
   RESPONSE
========================================================= */

function json(
  data,
  status = 200,
  request = null
) {
  return new Response(
    JSON.stringify(data),
    {
      status,

      headers: {
        ...JSON_HEADERS,

        ...(request
          ? corsHeaders(request)
          : {})
      }
    }
  );
}


/* =========================================================
   CORS
========================================================= */

function corsHeaders(
  request
) {
  const origin =
    request.headers.get(
      "Origin"
    );

  const allowedOrigins = [
    "https://adel-asset-hub.pages.dev"
  ];

  const allowedOrigin =
    allowedOrigins.includes(
      origin
    )
      ? origin
      : null;

  if (!allowedOrigin) {
    return {};
  }

  return {
    "Access-Control-Allow-Origin":
      allowedOrigin,

    "Access-Control-Allow-Headers":
      "Authorization, Content-Type",

    "Access-Control-Allow-Methods":
      "GET, POST, PATCH, DELETE, OPTIONS",

    "Access-Control-Max-Age":
      "86400",

    Vary:
      "Origin"
  };
}


/* =========================================================
   ERRORS
========================================================= */

function httpError(
  message,
  status
) {
  const error =
    new Error(message);

  error.status =
    status;

  return error;
}