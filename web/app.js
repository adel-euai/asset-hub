(() => {
  const SESSION_KEY = "adel_auth_session";

  const API_BASE =
    window.ASSET_HUB_API_BASE ||
    "https://asset-hub.adel-euai.workers.dev";

  const ASSET_BASE_URL =
    "https://adel-euai.github.io/asset-hub";

  const state = {
    projects: [],
    currentProject: null,
    assetType: null,
    pendingFile: null,
    pendingPreviewUrl: null
  };

  const $ = (id) =>
    document.getElementById(id);

  const views = {
    login: $("loginView"),
    app: $("appView"),
    project: $("projectView")
  };

  $("legalAgreement")?.addEventListener(
    "change",
    () => {
      $("loginButton").disabled =
        !$("legalAgreement").checked;
    }
  );

  $("loginForm")?.addEventListener(
    "submit",
    login
  );

  $("logoutButton")?.addEventListener(
    "click",
    logout
  );

  $("newProjectButton")?.addEventListener(
    "click",
    () => {
      $("projectDialog").showModal();
    }
  );

  $("cancelProject")?.addEventListener(
    "click",
    () => {
      $("projectDialog").close();
    }
  );

  $("projectForm")?.addEventListener(
    "submit",
    createProject
  );

  $("backButton")?.addEventListener(
    "click",
    showProjects
  );

  $("cancelAsset")?.addEventListener(
    "click",
    cancelAssetDialog
  );

  $("assetForm")?.addEventListener(
    "submit",
    uploadAsset
  );

  $("assetFile")?.addEventListener(
    "change",
    previewSelectedFile
  );

  const noteDialog =
    document.createElement("dialog");

  noteDialog.className =
    "note-dialog";

  noteDialog.innerHTML = `
    <form method="dialog" class="note-card">

      <div class="note-eyebrow">
        NOTICE
      </div>

      <h3 id="noteTitle">
        Confirm Action
      </h3>

      <p id="noteMessage"></p>

      <div
        id="noteInputWrap"
        class="note-input-wrap hidden"
      >
        <input
          id="noteInput"
          type="text"
          autocomplete="off"
        />
      </div>

      <div class="note-actions">

        <button
          type="button"
          id="noteCancel"
          class="ghost"
        >
          Cancel
        </button>

        <button
          type="button"
          id="noteConfirm"
          class="primary"
        >
          Confirm
        </button>

      </div>

    </form>
  `;

  document.body.appendChild(
    noteDialog
  );

  let noteResolver = null;

  $("noteCancel")?.addEventListener(
    "click",
    () => closeNote(null)
  );

  $("noteConfirm")?.addEventListener(
    "click",
    () => {
      const inputWrap =
        $("noteInputWrap");

      const value =
        inputWrap.classList.contains(
          "hidden"
        )
          ? true
          : $("noteInput").value;

      closeNote(value);
    }
  );

  function closeNote(value) {
    if (!noteResolver) {
      noteDialog.close();
      return;
    }

    const resolve =
      noteResolver;

    noteResolver = null;

    noteDialog.close();

    resolve(value);
  }

  function showConfirm(
    message,
    title = "Confirm Action"
  ) {
    return new Promise(
      (resolve) => {
        noteResolver = resolve;

        $("noteTitle").textContent =
          title;

        $("noteMessage").textContent =
          message;

        $("noteInputWrap")
          .classList.add("hidden");

        $("noteInput").value = "";

        $("noteConfirm").textContent =
          "Confirm";

        noteDialog.showModal();
      }
    );
  }

  function showPrompt(
    message,
    defaultValue = "",
    title = "Enter Value"
  ) {
    return new Promise(
      (resolve) => {
        noteResolver = resolve;

        $("noteTitle").textContent =
          title;

        $("noteMessage").textContent =
          message;

        $("noteInputWrap")
          .classList.remove("hidden");

        $("noteInput").value =
          defaultValue;

        $("noteConfirm").textContent =
          "Save";

        noteDialog.showModal();

        requestAnimationFrame(
          () =>
            $("noteInput")?.focus()
        );
      }
    );
  }

  boot();

  async function boot() {
    const session =
      getSession();

    if (!session?.token) {
      showLogin();
      return;
    }

    try {
      await api(
        "/api/auth/me"
      );

      await showProjects();
    } catch {
      clearSession();
      showLogin();
    }
  }

  async function login(event) {
    event.preventDefault();

    $("loginError").textContent =
      "";

    const username =
      $("username").value.trim();

    const password =
      $("password").value;

    try {
      const response =
        await fetch(
          `${API_BASE}/auth/login`,
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json"
            },

            body:
              JSON.stringify({
                username,
                password,
                project:
                  "asset-hub"
              })
          }
        );

      const data =
        await response
          .json()
          .catch(
            () => ({})
          );

      if (!response.ok) {
        throw new Error(
          data.error ||
          data.message ||
          "Login failed"
        );
      }

      const token =
        data.sessionToken ||
        data.token ||
        data.session?.token ||
        data.data?.token;

      if (!token) {
        throw new Error(
          "Authentication response did not contain a session token"
        );
      }

      sessionStorage.setItem(
        SESSION_KEY,
        JSON.stringify({
          token,

          expiresAt:
            data.expiresAt ||
            data.session?.expiresAt ||
            null,

          user:
            data.user ||
            data.session?.user ||
            null
        })
      );

      await showProjects();

    } catch (error) {
      $("loginError").textContent =
        error.message;
    }
  }

  function logout() {
    clearSession();
    showLogin();
  }

  function getSession() {
    try {
      return JSON.parse(
        sessionStorage.getItem(
          SESSION_KEY
        ) || "null"
      );
    } catch {
      return null;
    }
  }

  function clearSession() {
    sessionStorage.removeItem(
      SESSION_KEY
    );
  }

  async function api(
    path,
    options = {}
  ) {
    const session =
      getSession();

    const headers =
      new Headers(
        options.headers || {}
      );

    if (session?.token) {
      headers.set(
        "Authorization",
        `Bearer ${session.token}`
      );
    }

    const response =
      await fetch(
        `${API_BASE}${path}`,
        {
          ...options,
          headers
        }
      );

    if (
      response.status === 401
    ) {
      clearSession();
      showLogin();

      throw new Error(
        "Authentication required"
      );
    }

    const data =
      await response
        .json()
        .catch(
          () => ({})
        );

    if (!response.ok) {
      throw new Error(
        data.error ||
        "Request failed"
      );
    }

    return data;
  }

  async function showProjects() {
    hideAll();

    views.app.classList.remove(
      "hidden"
    );

    $("appError").textContent =
      "";

    try {
      const data =
        await api(
          "/api/projects"
        );

      state.projects =
        data.projects || [];

      renderProjects();

    } catch (error) {
      $("appError").textContent =
        error.message;
    }
  }

  function renderProjects() {
    const list =
      $("projectList");

    list.innerHTML = "";

    if (
      !state.projects.length
    ) {
      list.innerHTML = `
        <div class="empty card">

          <h2>
            No projects yet
          </h2>

          <p>
            Create the first Asset Hub project.
          </p>

        </div>
      `;

      return;
    }

    for (
      const project of
      state.projects
    ) {
      const card =
        document.createElement(
          "article"
        );

      card.className =
        "project-card";

      card.innerHTML = `
        <div class="project-card-main">

          <span class="project-name">
            ${escapeHtml(
              project.name
            )}
          </span>

          <span class="project-id">
            ${escapeHtml(
              project.id
            )}
          </span>

        </div>

        <div class="project-card-actions">

          <button
            type="button"
            class="primary small"
            data-open-project="${escapeHtml(
              project.id
            )}"
          >
            Open →
          </button>

          <button
            type="button"
            class="ghost small"
            data-rename-project="${escapeHtml(
              project.id
            )}"
          >
            Rename
          </button>

          <button
            type="button"
            class="danger small"
            data-delete-project="${escapeHtml(
              project.id
            )}"
          >
            Delete
          </button>

        </div>
      `;

      list.appendChild(card);
    }

    list
      .querySelectorAll(
        "[data-open-project]"
      )
      .forEach(
        (button) => {
          button.addEventListener(
            "click",
            () =>
              openProject(
                button.dataset
                  .openProject
              )
          );
        }
      );

    list
      .querySelectorAll(
        "[data-rename-project]"
      )
      .forEach(
        (button) => {
          button.addEventListener(
            "click",
            () =>
              renameProject(
                button.dataset
                  .renameProject
              )
          );
        }
      );

    list
      .querySelectorAll(
        "[data-delete-project]"
      )
      .forEach(
        (button) => {
          button.addEventListener(
            "click",
            () =>
              deleteProject(
                button.dataset
                  .deleteProject
              )
          );
        }
      );
  }

  async function renameProject(
    projectId
  ) {
    const project =
      state.projects.find(
        (item) =>
          item.id === projectId
      );

    if (!project) {
      return;
    }

    const name =
      await showPrompt(
        "Enter the new project name:",
        project.name,
        "Rename Project"
      );

    if (name === null) {
      return;
    }

    const newName =
      name.trim();

    if (!newName) {
      $("appError").textContent =
        "Project name cannot be empty.";

      return;
    }

    if (
      newName ===
      project.name
    ) {
      return;
    }

    try {
      await api(
        `/api/projects/${encodeURIComponent(
          projectId
        )}`,
        {
          method: "PATCH",

          headers: {
            "Content-Type":
              "application/json"
          },

          body:
            JSON.stringify({
              name:
                newName
            })
        }
      );

      await showProjects();

    } catch (error) {
      $("appError").textContent =
        error.message;
    }
  }

  async function deleteProject(
    projectId
  ) {
    const project =
      state.projects.find(
        (item) =>
          item.id === projectId
      );

    if (!project) {
      return;
    }

    const confirmed =
      await showConfirm(
        `Delete "${project.name}" permanently?\n\nThis will delete the project and its current assets.`,
        "Delete Project"
      );

    if (!confirmed) {
      return;
    }

    try {
      await api(
        `/api/projects/${encodeURIComponent(
          projectId
        )}`,
        {
          method:
            "DELETE"
        }
      );

      await showProjects();

    } catch (error) {
      $("appError").textContent =
        error.message;
    }
  }

  async function openProject(id) {
    hideAll();

    views.project.classList.remove(
      "hidden"
    );

    $("projectError").textContent =
      "";

    try {
      const data =
        await api(
          `/api/projects/${encodeURIComponent(
            id
          )}`
        );

      state.currentProject =
        data.project;

      renderProject();

    } catch (error) {
      $("projectError").textContent =
        error.message;
    }
  }

  function renderProject() {
    const project =
      state.currentProject;

    const assets =
      project.assets || {};

    $("projectTitle").textContent =
      project.name;

    const definitions = [
      [
        "banner",
        "Banner",
        "4 × 1",
        "featured"
      ],

      [
        "cover",
        "Cover",
        "1.9 × 1",
        "featured"
      ],

      [
        "logo",
        "Logo",
        "1 × 1",
        "square"
      ],

      [
        "og-image",
        "OG Image",
        "1.9 × 1",
        "wide"
      ]
    ];

    const screenshots =
      Array.from(
        {
          length: 9
        },
        (_, index) =>
          index + 1
      );

    const subLogos =
      Array.from(
        {
          length: 60
        },
        (_, index) =>
          index + 1
      );

    const screenshotCards =
      screenshots
        .map(
          (slot) =>
            renderAssetCard(
              `screenshot-${slot}`,
              `Screenshot ${slot}`,
              "2.25 × 1",
              "wide",
              assets
                .screenshots?.[
                String(slot)
              ] || null
            )
        )
        .join("");

    const subLogoCards =
      subLogos
        .map(
          (slot) =>
            renderAssetCard(
              `sub-logo-${slot}`,
              `Sub Logo ${slot}`,
              "1 × 1",
              "square",
              assets[
                "sub-logos"
              ]?.[
                String(slot)
              ] || null
            )
        )
        .join("");

    $("assetGrid").innerHTML = `

      <section class="asset-section asset-section-fixed">

        <div class="section-heading">
          <div>
            <div class="eyebrow">
              PRIMARY ASSETS
            </div>

            <h3>
              Core Assets
            </h3>

            <p>
              Banner, Cover, Logo and OG Image
            </p>
          </div>
        </div>

        <div class="asset-fixed-layout">

          <div class="asset-fixed-column">

            ${renderAssetCard(
              "banner",
              "Banner",
              "4 × 1",
              "featured",
              assets.banner || null
            )}

            ${renderAssetCard(
              "logo",
              "Logo",
              "1 × 1",
              "square",
              assets.logo || null
            )}

          </div>

          <div class="asset-fixed-column">

            ${renderAssetCard(
              "cover",
              "Cover",
              "1.9 × 1",
              "wide",
              assets.cover || null
            )}

            ${renderAssetCard(
              "og-image",
              "OG Image",
              "1.9 × 1",
              "wide",
              assets["og-image"] || null
            )}

          </div>

        </div>

      </section>


      <section class="asset-section">

        <div class="section-heading">

          <div>

            <div class="eyebrow">
              SCREENSHOTS
            </div>

            <h3>
              Screenshot Assets
            </h3>

            <p>
              Up to 9 screenshots · 2.25 × 1
            </p>

          </div>

        </div>

        <div class="asset-slot-grid screenshot-slot-grid">
          ${screenshotCards}
        </div>

      </section>


      <section class="asset-section">

        <div class="section-heading">

          <div>

            <div class="eyebrow">
              SUB LOGOS
            </div>

            <h3>
              Sub Logo Assets
            </h3>

            <p>
              Up to 60 sub logos · 1 × 1
            </p>

          </div>

        </div>

        <div class="asset-slot-grid sub-logo-slot-grid">
          ${subLogoCards}
        </div>

      </section>
    `;

    /*
     * IMPORTANT:
     * These buttons are created dynamically by renderProject().
     * Therefore their listeners must be attached AFTER innerHTML.
     */

    document
      .querySelectorAll(
        "[data-copy-link]"
      )
      .forEach(
        (button) => {
          button.addEventListener(
            "click",
            async () => {
              const url =
                button.dataset
                  .copyLink;

              try {
                await navigator.clipboard.writeText(
                  url
                );

                const original =
                  button.textContent;

                button.textContent =
                  "✓";

                setTimeout(
                  () => {
                    button.textContent =
                      original;
                  },
                  1200
                );

              } catch {
                button.textContent =
                  "!";
              }
            }
          );
        }
      );

    document
      .querySelectorAll(
        "[data-upload]"
      )
      .forEach(
        (button) => {
          button.addEventListener(
            "click",
            () =>
              openAssetDialog(
                button.dataset
                  .upload
              )
          );
        }
      );

    document
      .querySelectorAll(
        "[data-delete]"
      )
      .forEach(
        (button) => {
          button.addEventListener(
            "click",
            () =>
              deleteCurrent(
                button.dataset
                  .delete
              )
          );
        }
      );

    [
      ...definitions.map(
        ([type]) => type
      ),

      ...screenshots.map(
        (slot) =>
          `screenshot-${slot}`
      ),

      ...subLogos.map(
        (slot) =>
          `sub-logo-${slot}`
      )
    ].forEach(
      (type) => {
        const asset =
          getAsset(type);

        if (asset) {
          loadPreview(type);
        }
      }
    );
  }

function renderAssetCard(
  type,
  label,
  ratio,
  size,
  asset
) {
  const slotClass =
    type.startsWith(
      "screenshot-"
    ) ||
    type.startsWith(
      "sub-logo-"
    )
      ? "asset-slot-card"
      : "";

  const previewClass =
    type.startsWith(
      "screenshot-"
    )
      ? "screenshot"
      : type.startsWith(
          "sub-logo-"
        )
        ? "sub-logo"
        : type;

  return `
    <article
      class="asset-card ${slotClass} ${
        size === "featured"
          ? "asset-featured-card"
          : ""
      }"
    >

      <div class="asset-head">

        <div>

          <div class="eyebrow">
            ${escapeHtml(
              label
            )}
          </div>

          <div class="ratio">
            ${escapeHtml(
              ratio
            )}
          </div>

        </div>

        <span class="rev">
          ${
            asset
              ? "Uploaded"
              : "Not uploaded"
          }
        </span>

      </div>

      <div
        class="preview ${escapeHtml(
          previewClass
        )}"
        id="preview-${escapeHtml(
          type
        )}"
      >
        ${
          asset
            ? "<span>Loading preview…</span>"
            : "<span>Empty</span>"
        }
      </div>

      <div class="asset-meta">

        ${
          asset
            ? `
              <span>
                ${escapeHtml(
                  asset.filename ||
                    ""
                )}
              </span>

              <button
                type="button"
                class="copy-link-button"
                data-copy-link="${escapeHtml(
                  getAssetPublicUrl(
                    type,
                    asset
                  )
                )}"
                title="Copy asset link"
                aria-label="Copy asset link"
              >
                □
              </button>
            `
            : `<span>Not uploaded</span>`
        }

      </div>

      <div class="asset-actions">

        <button
          class="primary small"
          data-upload="${escapeHtml(
            type
          )}"
        >
          ${
            asset
              ? "Replace"
              : "Upload"
          }
        </button>

        ${
          asset
            ? `
              <button
                class="danger small"
                data-delete="${escapeHtml(
                  type
                )}"
              >
                Delete
              </button>
            `
            : ""
        }

      </div>

    </article>
  `;
}

  function getAsset(type) {
    const assets =
      state.currentProject
        ?.assets || {};

    if (
      type.startsWith(
        "screenshot-"
      )
    ) {
      return (
        assets.screenshots?.[
          type.slice(11)
        ] || null
      );
    }

    if (
      type.startsWith(
        "sub-logo-"
      )
    ) {
      return (
        assets[
          "sub-logos"
        ]?.[
          type.slice(9)
        ] || null
      );
    }

    return (
      assets[type] ||
      null
    );
  }

  function getAssetPublicUrl(
    type,
    asset
  ) {
    const projectId =
      state.currentProject.id;

    let path;

    if (
      type.startsWith(
        "screenshot-"
      )
    ) {
      const slot =
        type.slice(11);

      const extension =
        String(
          asset.filename || "png"
        )
          .split(".")
          .pop();

      path =
        `projects/${projectId}/` +
        `screenshot/${slot}.${extension}`;

    } else if (
      type.startsWith(
        "sub-logo-"
      )
    ) {
      const slot =
        type.slice(9);

      const extension =
        String(
          asset.filename || "png"
        )
          .split(".")
          .pop();

      path =
        `projects/${projectId}/` +
        `sub-logo/${slot}.${extension}`;

    } else {
      path =
        `projects/${projectId}/` +
        `${asset.filename}`;
    }

    return `${ASSET_BASE_URL}/${path}`;
  }

  function openAssetDialog(
    type
  ) {
    state.assetType =
      type;

    state.pendingFile =
      null;

    clearPendingPreview();

    const label =
      assetLabel(type);

    $("assetDialogEyebrow")
      .textContent =
      label.toUpperCase();

    $("assetDialogTitle")
      .textContent =
      getAsset(type)
        ? `Replace ${label}`
        : `Upload ${label}`;

    $("assetFile").value =
      "";

    $("assetError").textContent =
      "";

    $("assetFile").accept =
      "image/png,image/jpeg,image/webp,image/gif,image/avif";

    $("assetPreview").innerHTML =
      "<span>Select an image to preview.</span>";

    $("assetPreview")
      .classList.remove(
        "hidden"
      );

    $("commitAssetButton")
      .disabled = false;

    $("commitAssetButton")
      .textContent =
      getAsset(type)
        ? "Replace"
        : "Upload";

    $("assetDialog")
      .showModal();
  }

  function assetLabel(type) {
    if (
      type === "banner"
    ) {
      return "Banner";
    }

    if (
      type === "cover"
    ) {
      return "Cover";
    }

    if (
      type === "logo"
    ) {
      return "Logo";
    }

    if (
      type === "og-image"
    ) {
      return "OG Image";
    }

    if (
      type.startsWith(
        "screenshot-"
      )
    ) {
      return `Screenshot ${type.slice(
        11
      )}`;
    }

    if (
      type.startsWith(
        "sub-logo-"
      )
    ) {
      return `Sub Logo ${type.slice(
        9
      )}`;
    }

    return type;
  }

  function previewSelectedFile() {
    const file =
      $("assetFile")
        .files[0];

    state.pendingFile =
      file || null;

    clearPendingPreview();

    if (!file) {
      return;
    }

    if (
      !file.type.startsWith(
        "image/"
      )
    ) {
      $("assetPreview")
        .innerHTML =
        `<span>${escapeHtml(
          file.name
        )}</span>`;

      return;
    }

    const objectUrl =
      URL.createObjectURL(
        file
      );

    state.pendingPreviewUrl =
      objectUrl;

    const image =
      document.createElement(
        "img"
      );

    image.src =
      objectUrl;

    image.alt =
      file.name;

    image.onload = () => {
      if (
        state.pendingPreviewUrl ===
        objectUrl
      ) {
        state.pendingPreviewUrl =
          null;
      }

      URL.revokeObjectURL(
        objectUrl
      );
    };

    $("assetPreview")
      .classList.remove(
        "hidden"
      );

    $("assetPreview")
      .replaceChildren(
        image
      );
  }

  function clearPendingPreview() {
    if (
      state.pendingPreviewUrl
    ) {
      URL.revokeObjectURL(
        state.pendingPreviewUrl
      );

      state.pendingPreviewUrl =
        null;
    }

    const preview =
      $("assetPreview");

    if (!preview) {
      return;
    }

    preview.innerHTML =
      "<span>Select an image to preview.</span>";
  }

  function cancelAssetDialog() {
    state.pendingFile =
      null;

    clearPendingPreview();

    $("assetDialog")
      .close();
  }

  async function loadPreview(
    type
  ) {
    const box =
      $(
        `preview-${type}`
      );

    if (!box) {
      return;
    }

    try {
      const session =
        getSession();

      if (!session?.token) {
        throw new Error(
          "Authentication required"
        );
      }

      const response =
        await fetch(
          `${API_BASE}/api/projects/${encodeURIComponent(
            state.currentProject.id
          )}/assets/${encodeURIComponent(
            type
          )}/file`,
          {
            headers: {
              Authorization:
                `Bearer ${session.token}`
            }
          }
        );

      if (
        response.status === 401
      ) {
        clearSession();
        showLogin();
        return;
      }

      if (!response.ok) {
        throw new Error(
          "Preview unavailable"
        );
      }

      const blob =
        await response.blob();

      const objectUrl =
        URL.createObjectURL(
          blob
        );

      const image =
        document.createElement(
          "img"
        );

      image.src =
        objectUrl;

      image.alt =
        assetLabel(type);

      image.onload = () =>
        URL.revokeObjectURL(
          objectUrl
        );

      image.onerror = () => {
        URL.revokeObjectURL(
          objectUrl
        );

        box.innerHTML =
          "<span>Preview unavailable</span>";
      };

      box.replaceChildren(
        image
      );

    } catch {
      box.innerHTML =
        "<span>Preview unavailable</span>";
    }
  }

  async function uploadAsset(
    event
  ) {
    event.preventDefault();

    $("assetError").textContent =
      "";

    const file =
      state.pendingFile ||
      $("assetFile")
        .files[0];

    if (!file) {
      $("assetError")
        .textContent =
        "Please select an image.";

      return;
    }

    if (
      !file.type.startsWith(
        "image/"
      )
    ) {
      $("assetError")
        .textContent =
        "Please select a valid image file.";

      return;
    }

    const form =
      new FormData();

    form.append(
      "file",
      file
    );

    const button =
      $("commitAssetButton");

    button.disabled =
      true;

    button.textContent =
      "Committing…";

    try {
      await api(
        `/api/projects/${encodeURIComponent(
          state.currentProject.id
        )}/assets/${encodeURIComponent(
          state.assetType
        )}`,
        {
          method: "POST",
          body: form
        }
      );

      state.pendingFile =
        null;

      clearPendingPreview();

      $("assetDialog")
        .close();

      await openProject(
        state.currentProject.id
      );

    } catch (error) {
      $("assetError")
        .textContent =
        error.message;

      button.disabled =
        false;

      button.textContent =
        getAsset(
          state.assetType
        )
          ? "Replace"
          : "Upload";
    }
  }

  async function deleteCurrent(
    type
  ) {
    const confirmed =
      await showConfirm(
        `Delete the current ${assetLabel(
          type
        )}?`,
        `Delete ${assetLabel(
          type
        )}`
      );

    if (!confirmed) {
      return;
    }

    try {
      await api(
        `/api/projects/${encodeURIComponent(
          state.currentProject.id
        )}/assets/${encodeURIComponent(
          type
        )}`,
        {
          method:
            "DELETE"
        }
      );

      await openProject(
        state.currentProject.id
      );

    } catch (error) {
      $("projectError")
        .textContent =
        error.message;
    }
  }

  async function createProject(
    event
  ) {
    event.preventDefault();

    try {
      await api(
        "/api/projects",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json"
          },

          body:
            JSON.stringify({
              name:
                $("projectName")
                  .value
                  .trim(),

              id:
                $("projectId")
                  .value
                  .trim()
            })
        }
      );

      $("projectDialog")
        .close();

      $("projectForm")
        .reset();

      await showProjects();

    } catch (error) {
      $("appError")
        .textContent =
        error.message;
    }
  }

  function hideAll() {
    Object.values(
      views
    ).forEach(
      (view) => {
        view?.classList.add(
          "hidden"
        );
      }
    );
  }

  function showLogin() {
    hideAll();

    views.login.classList.remove(
      "hidden"
    );

    if ($("password")) {
      $("password").value =
        "";
    }
  }

  function escapeHtml(
    value
  ) {
    return String(value)
      .replaceAll(
        "&",
        "&amp;"
      )
      .replaceAll(
        "<",
        "&lt;"
      )
      .replaceAll(
        ">",
        "&gt;"
      )
      .replaceAll(
        '"',
        "&quot;"
      )
      .replaceAll(
        "'",
        "&#039;"
      );
  }
})();