import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box,
  Drawer,
  List,
  ListItem,
  ListItemText,
  Typography,
  Snackbar,
  Paper,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button
} from '@mui/material';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import LibraryIcon from '@mui/icons-material/Apps';
import InstancesIcon from '@mui/icons-material/Storage';
import SettingsIcon from '@mui/icons-material/Settings';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemButton from '@mui/material/ListItemButton';
import { useTranslation } from 'react-i18next';

import LibraryPage from './Library/Library';
import InstancesPage from './Instances';
import SettingsPage from './Settings/Settings';
import UpdateBanner from '../components/UpdateBanner';
import { SettingsKey } from '../../types/settings.js';
import { API } from '../services/api.js';

type navbar_page = 'library' | 'instances' | 'settings';
type severityLevels = 'info' | 'success' | 'warning' | 'error';

/** Sentinel id for the in-memory instance shown before anything is written to disk */
const DRAFT_INSTANCE_ID = '__draft__';

export default function MainPage({ darkMode, setDarkMode }) {
  const { t } = useTranslation();

  const [collectionsPath, setCollectionsPath] = useState('');
  const [documentsPath, setDocumentsPath] = useState('');
  const [showPathDialog, setShowPathDialog] = useState(false);
  const [pendingConfigPath, setPendingConfigPath] = useState('');
  const [pendingDocumentsPath, setPendingDocumentsPath] = useState('');
  const [permitAddCatalogues, setPermitAddCatalogues] = useState(true);
  const [permitCatalogueModifications, setPermitCatalogueModifications] = useState(true);
  const [permitImportShards, setPermitImportShards] = useState(true);
  const [permitAddRepos, setPermitAddRepos] = useState(true);
  const [drawerOpen] = useState(true);
  const [view, setView] = useState<navbar_page>('library');
  const [instancesList, setInstancesList] = useState([]);
  const [log, setLog] = useState([]);
  const [severity, setSeverity] = useState<severityLevels>('info');
  const [message, setMessage] = useState('');
  const [showHiddenParams, setShowHiddenParams] = useState(false);
  const [showLogPanel, setShowLogPanel] = useState(false);
  const [autoStoreDir, setAutoStoreDir] = useState(false);
  const [nextflowSyntaxParser, setNextflowSyntaxParser] = useState('1');
  const [autoOutdir, setAutoOutdir] = useState(true);
  const [outputPath, setOutputPath] = useState('');
  const [storeDirPath, setStoreDirPath] = useState('');
  const [resourceLimitsCpu, setResourceLimitsCpu] = useState(0);
  const [resourceLimitsMemory, setResourceLimitsMemory] = useState(0);
  const [customNextflowConfig, setCustomNextflowConfig] = useState('');
  const [open, setOpen] = useState(false);
  const [item, setItem] = useState('');
  // Instance prepared for a workflow but not yet written to disk. It is
  // materialised as soon as the user edits a parameter or launches it.
  const [draftInstance, setDraftInstance] = useState<{
    instance: any;
    params: Record<string, unknown>;
    workflow_id: string;
    version: string;
    /** Set once the draft has been written to disk */
    materialized?: any;
  } | null>(null);
  const draftRef = useRef(draftInstance);
  draftRef.current = draftInstance;
  const materializingRef = useRef<Promise<any> | null>(null);
  const materializedDraftRef = useRef<any>(null);
  const [navigateToSettingsPage, setNavigateToSettingsPage] = useState('');
  const [catalogueParseResults, setCatalogueParseResults] = useState([]);
  const [showCatalogueParseErrors, setShowCatalogueParseErrors] = useState(false);
  const [wslMismatch, setWslMismatch] = useState<{
    storedCpu: number;
    storedMem: number;
    fileCpu?: number;
    fileMem?: number;
  } | null>(null);
  const [wslMismatchDismissed, setWslMismatchDismissed] = useState(false);

  const instancesRequestRef = useRef(0);

  const refreshInstancesList = useCallback(async () => {
    const requestId = ++instancesRequestRef.current;
    try {
      const result = await API.listWorkflowInstances();
      // Ignore stale responses so an older list cannot overwrite a newer one
      // (e.g. reverting a just-launched instance to 'created').
      if (!result.ok || requestId !== instancesRequestRef.current) return;
      setInstancesList(
        result.data.map((instance) => ({
          instance: instance,
          name: instance.name
        }))
      );
    } catch {
      // Transient transport failure: keep the last known list.
    }
  }, []);

  useEffect(() => {
    (async () => {
      API.settingsGet(SettingsKey.DarkMode).then((result) => {
        if (result.ok) setDarkMode(result.data);
      });
      API.settingsGet(SettingsKey.PermitAddCatalogues).then((result) => {
        if (result.ok && result.data !== undefined) setPermitAddCatalogues(result.data);
      });
      API.settingsGet(SettingsKey.PermitCatalogueModifications).then((result) => {
        if (result.ok && result.data !== undefined) setPermitCatalogueModifications(result.data);
      });
      API.settingsGet(SettingsKey.PermitImportShards).then((result) => {
        if (result.ok && result.data !== undefined) setPermitImportShards(result.data);
      });
      API.settingsGet(SettingsKey.PermitAddRepos).then((result) => {
        if (result.ok && result.data !== undefined) setPermitAddRepos(result.data);
      });
      API.settingsGet(SettingsKey.ShowLogPanel).then((result) => {
        if (result.ok) setShowLogPanel(result.data);
      });
      API.settingsGet(SettingsKey.AutoStoreDir).then((result) => {
        if (result.ok) setAutoStoreDir(result.data);
      });
      API.settingsGet(SettingsKey.NextflowSyntaxParser).then((result) => {
        if (result.ok) setNextflowSyntaxParser(result.data);
      });
      API.settingsGet(SettingsKey.AutoOutdir).then((result) => {
        if (result.ok) setAutoOutdir(result.data);
      });
      API.getOutputPath().then((result) => {
        if (result.ok) setOutputPath(result.data);
      });
      API.getStoreDirPath().then((result) => {
        if (result.ok) setStoreDirPath(result.data);
      });
      API.settingsGet(SettingsKey.ResourceLimitsCpu).then((result) => {
        if (result.ok) setResourceLimitsCpu(result.data);
      });
      API.settingsGet(SettingsKey.ResourceLimitsMemory).then((result) => {
        if (result.ok) setResourceLimitsMemory(result.data);
      });
      API.settingsGet(SettingsKey.CustomNextflowConfig).then((result) => {
        if (result.ok) setCustomNextflowConfig(result.data);
      });
      const r = await API.init();
      if (!r.ok) {
        console.error('Init failed:', r.error.message);
      }
      const parseResults = await API.getCatalogueParseResults();
      if (parseResults.ok) {
        const failures = parseResults.data.filter((res) => !res.success);
        if (failures.length > 0) {
          setCatalogueParseResults(parseResults.data);
          setShowCatalogueParseErrors(true);
        }
      }
      // Check WSL config mismatch on startup
      API.checkWslConfig().then((result) => {
        if (result.ok && result.data) {
          const d = result.data;
          const storedActive = d.storedCpu > 0 || d.storedMem > 0;
          const fileSet = d.fileCpu !== undefined || d.fileMem !== undefined;
          if (storedActive && fileSet && (d.storedCpu !== d.fileCpu || d.storedMem !== d.fileMem)) {
            setWslMismatch(d);
          }
        }
      });
      const pathResult = await API.getCollectionsPath();
      if (pathResult.ok) setCollectionsPath(pathResult.data);

      const dPathResult = await API.getDocumentsPath();
      if (dPathResult.ok) setDocumentsPath(dPathResult.data);

      const missing = r.data || {};
      if (missing.config || missing.documents) {
        const defaultPaths = await API.getDefaultPaths();
        setPendingConfigPath(
          missing.config && defaultPaths.ok
            ? defaultPaths.data.config
            : pathResult.ok
              ? pathResult.data
              : ''
        );
        setPendingDocumentsPath(
          missing.documents && defaultPaths.ok
            ? defaultPaths.data.documents
            : dPathResult.ok
              ? dPathResult.data
              : ''
        );
        setShowPathDialog(true);
      }

      refreshInstancesList();
    })();
  }, []);

  // Opening a workflow no longer creates an instance on disk. A draft is shown
  // instead and only materialised on first edit or launch, so browsing the
  // library does not leave empty instances behind.
  const createWorkflowInstance = async (repo) => {
    let result;
    try {
      result = await API.prepareWorkflowInstance(repo.id, repo.version);
    } catch (err: any) {
      logMessage(`Failed to open workflow: ${err?.message ?? 'Unknown error'}`, 'error');
      return;
    }
    if (!result.ok) {
      logMessage(`Failed to open workflow: ${result.error?.message ?? 'Unknown error'}`, 'error');
      return;
    }
    const prepared = result.data;
    materializedDraftRef.current = null;
    setDraftInstance({
      ...prepared,
      instance: { ...prepared.instance, id: DRAFT_INSTANCE_ID }
    });
    setView('instances');
    setItem(DRAFT_INSTANCE_ID);
  };

  // Create the draft's instance on disk, keeping the reserved name and the
  // parameters entered so far. Concurrent callers share a single creation.
  //
  // Materialising from an edit keeps the Parameters page mounted (and the
  // input focused) by leaving the draft instance untouched; `activate` is used
  // on launch to switch to the real instance, which happens outside typing.
  const materializeDraft = useCallback(
    async (params?: Record<string, unknown>, activate = false) => {
      const activateInstance = (instance: any) => {
        setDraftInstance(null);
        setItem(instance.id);
      };

      // Already written to disk: reuse it so repeated saves never create a
      // second instance, even after the draft has been activated.
      if (materializedDraftRef.current) {
        const instance = materializedDraftRef.current;
        if (activate) activateInstance(instance);
        return instance;
      }

      const draft = draftRef.current;
      if (!draft) return null;

      if (materializingRef.current) {
        const instance = await materializingRef.current;
        if (instance && activate) activateInstance(instance);
        return instance;
      }

      const run = (async () => {
        let result;
        try {
          result = await API.createWorkflowInstance(draft.workflow_id, draft.version, {
            name: draft.instance.name,
            params: params ?? draft.params
          });
        } catch (err: any) {
          logMessage(`Failed to create instance: ${err?.message ?? 'Unknown error'}`, 'error');
          return null;
        }
        if (!result.ok) {
          logMessage(
            `Failed to create instance: ${result.error?.message ?? 'Unknown error'}`,
            'error'
          );
          return null;
        }
        return result.data;
      })();
      materializingRef.current = run;

      let instance;
      try {
        instance = await run;
      } finally {
        materializingRef.current = null;
      }
      if (!instance) return null;

      // Ignore the result if the user has since opened another workflow.
      if (draftRef.current === draft) materializedDraftRef.current = instance;
      setInstancesList((prev) => [
        ...prev.filter((entry) => entry.instance.id !== instance.id),
        { instance, name: instance.name }
      ]);
      if (activate) {
        // Launch: switch to the real instance (expected remount, no typing).
        activateInstance(instance);
      } else {
        // Keep the mounted Parameters page (and its input focus) by recording
        // the instance alongside the unchanged draft instance.
        setDraftInstance((prev) =>
          prev && prev.instance.id === DRAFT_INSTANCE_ID
            ? { ...prev, materialized: instance }
            : prev
        );
      }
      return instance;
    },
    []
  );

  const navigateToSettingsEnv = () => {
    setView('settings');
    setNavigateToSettingsPage('environment');
  };

  const handlePickConfigDir = async () => {
    const result = await API.pickDirectory();
    if (result.ok && result.data) setPendingConfigPath(result.data);
  };

  const handlePickDocumentsDir = async () => {
    const result = await API.pickDirectory();
    if (result.ok && result.data) setPendingDocumentsPath(result.data);
  };

  const handleDefaults = async () => {
    const result = await API.getDefaultPaths();
    if (result.ok && result.data) {
      setPendingConfigPath(result.data.config);
      setPendingDocumentsPath(result.data.documents);
    }
  };

  const handleConfirmPaths = async () => {
    await API.setConfigPath(pendingConfigPath);
    await API.setDocumentsPath(pendingDocumentsPath);
    setCollectionsPath(pendingConfigPath);
    setDocumentsPath(pendingDocumentsPath);
    setShowPathDialog(false);
    await API.init();
    const parseResults = await API.getCatalogueParseResults();
    if (parseResults.ok) {
      const failures = parseResults.data.filter((res) => !res.success);
      if (failures.length > 0) {
        setCatalogueParseResults(parseResults.data);
        setShowCatalogueParseErrors(true);
      }
    }
    const pathResult = await API.getCollectionsPath();
    if (pathResult.ok) setCollectionsPath(pathResult.data);
    refreshInstancesList();
  };

  const handleRestartWsl = () => {
    API.restartWsl().then((result) => {
      setWslMismatch(null);
      setWslMismatchDismissed(true);
      logMessage(
        result.ok
          ? 'WSL restarted successfully. Close and reopen the terminal to apply changes.'
          : `Failed to restart WSL: ${result.error?.message || 'Unknown error'}`,
        result.ok ? 'info' : 'error'
      );
    });
  };

  const handleDismissWslMismatch = () => {
    setWslMismatch(null);
    setWslMismatchDismissed(true);
  };

  const handleShowLogPanel = (value: boolean) => {
    setShowLogPanel(value);
    API.settingsSet(SettingsKey.ShowLogPanel, value);
  };

  const logMessage = (text, level: severityLevels = 'info') => {
    setLog((prevLog) => [...prevLog, text]);
    setMessage(text);
    setSeverity(level);
    setOpen(true);
    const consoleFn =
      level === 'error' ? console.error : level === 'warning' ? console.warn : console.log;
    consoleFn(text);
  };

  return (
    <Box sx={{ display: 'flex', height: '100vh' }}>
      <Drawer
        variant="permanent"
        open={drawerOpen}
        sx={{
          width: drawerOpen ? 200 : 56,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: drawerOpen ? 200 : 56,
            overflowX: 'hidden',
            transition: (theme) =>
              theme.transitions.create('width', {
                easing: theme.transitions.easing.sharp,
                duration: theme.transitions.duration.enteringScreen
              })
          }
        }}
      >
        <List
          sx={(theme) => ({
            '& .MuiListItemButton-root.Mui-selected': {
              boxShadow: `inset 4px 0 0 ${theme.palette.primary.main}`,
              '& .MuiListItemIcon-root': {
                color: theme.palette.text.primary
              },
              '& .MuiListItemText-root': {
                color: theme.palette.text.primary
              },
              '&:hover': {
                backgroundColor: theme.palette.action.selected
              }
            }
          })}
        >
          <ListItem disablePadding>
            <ListItemButton
              id="sidebar-library-button"
              selected={view === 'library'}
              onClick={() => setView('library')}
            >
              <ListItemIcon>
                <LibraryIcon />
              </ListItemIcon>
              {drawerOpen && <ListItemText primary={t('sidebar.library')} />}
            </ListItemButton>
          </ListItem>
          <ListItem disablePadding>
            <ListItemButton
              id="sidebar-instances-button"
              selected={view === 'instances'}
              onClick={() => {
                setItem('');
                setView('instances');
              }}
            >
              <ListItemIcon>
                <InstancesIcon />
              </ListItemIcon>
              {drawerOpen && <ListItemText primary={t('sidebar.instances')} />}
            </ListItemButton>
          </ListItem>
          <ListItem disablePadding>
            <ListItemButton
              id="sidebar-settings-button"
              selected={view === 'settings'}
              onClick={() => setView('settings')}
            >
              <ListItemIcon>
                <SettingsIcon />
              </ListItemIcon>
              {drawerOpen && <ListItemText primary={t('sidebar.settings')} />}
            </ListItemButton>
          </ListItem>
        </List>
      </Drawer>

      {wslMismatch && !wslMismatchDismissed && (
        <Alert
          severity="warning"
          sx={{ position: 'fixed', bottom: 16, right: 16, zIndex: 9999, maxWidth: 500 }}
          onClose={handleDismissWslMismatch}
          action={
            <Button color="inherit" size="small" onClick={handleRestartWsl}>
              Restart WSL
            </Button>
          }
        >
          GLACIER resource limits ({wslMismatch.storedCpu || '∞'} CPUs,{' '}
          {wslMismatch.storedMem || '∞'} GB) don't match WSL config ({wslMismatch.fileCpu ?? '∞'}{' '}
          CPUs, {wslMismatch.fileMem ?? '∞'} GB).{' '}
          {wslMismatch.fileCpu === undefined && wslMismatch.fileMem === undefined
            ? 'No .wslconfig found.'
            : ''}
        </Alert>
      )}

      <Box sx={{ flex: 1, minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        <UpdateBanner />
        <PanelGroup direction="vertical" style={{ flex: 1, minHeight: 0, width: '100%' }}>
          <Panel>
            <Paper
              variant="outlined"
              sx={{ width: '100%', height: '100%', overflowY: 'auto', minHeight: 0, p: 3 }}
              square
            >
              {view === 'library' ? (
                <LibraryPage
                  createWorkflowInstance={createWorkflowInstance}
                  permitAddCatalogues={permitAddCatalogues}
                  permitCatalogueModifications={permitCatalogueModifications}
                  permitImportShards={permitImportShards}
                  permitAddRepos={permitAddRepos}
                  navigateToSettingsEnv={navigateToSettingsEnv}
                  logMessage={logMessage}
                />
              ) : view === 'instances' ? (
                <InstancesPage
                  instancesList={instancesList}
                  refreshInstancesList={refreshInstancesList}
                  logMessage={logMessage}
                  item={item}
                  setItem={setItem}
                  showHiddenParams={showHiddenParams}
                  draftInstance={draftInstance}
                  materializeDraft={materializeDraft}
                />
              ) : view === 'settings' ? (
                <SettingsPage
                  darkMode={darkMode}
                  setDarkMode={setDarkMode}
                  collectionsPath={collectionsPath}
                  documentsPath={documentsPath}
                  permitAddCatalogues={permitAddCatalogues}
                  setPermitAddCatalogues={setPermitAddCatalogues}
                  permitCatalogueModifications={permitCatalogueModifications}
                  setPermitCatalogueModifications={setPermitCatalogueModifications}
                  permitImportShards={permitImportShards}
                  setPermitImportShards={setPermitImportShards}
                  permitAddRepos={permitAddRepos}
                  setPermitAddRepos={setPermitAddRepos}
                  showHiddenParams={showHiddenParams}
                  setShowHiddenParams={setShowHiddenParams}
                  showLogPanel={showLogPanel}
                  onShowLogPanelChange={handleShowLogPanel}
                  autoStoreDir={autoStoreDir}
                  setAutoStoreDir={setAutoStoreDir}
                  nextflowSyntaxParser={nextflowSyntaxParser}
                  setNextflowSyntaxParser={setNextflowSyntaxParser}
                  autoOutdir={autoOutdir}
                  setAutoOutdir={setAutoOutdir}
                  outputPath={outputPath}
                  setOutputPath={setOutputPath}
                  storeDirPath={storeDirPath}
                  setStoreDirPath={setStoreDirPath}
                  resourceLimitsCpu={resourceLimitsCpu}
                  setResourceLimitsCpu={setResourceLimitsCpu}
                  resourceLimitsMemory={resourceLimitsMemory}
                  setResourceLimitsMemory={setResourceLimitsMemory}
                  customNextflowConfig={customNextflowConfig}
                  setCustomNextflowConfig={setCustomNextflowConfig}
                  navigateToPage={navigateToSettingsPage}
                  setNavigateToPage={setNavigateToSettingsPage}
                  onReopenSetup={() => {
                    setPendingConfigPath(collectionsPath);
                    setPendingDocumentsPath(documentsPath);
                    setShowPathDialog(true);
                  }}
                />
              ) : null}
            </Paper>
          </Panel>

          {showLogPanel && <PanelResizeHandle />}

          {showLogPanel && (
            <Panel defaultSize={10} minSize={2} collapsible>
              <Paper
                variant="outlined"
                sx={{ width: '100%', height: '100%', overflowY: 'auto' }}
                square
              >
                <Box
                  id="logMessage"
                  component="pre"
                  sx={{ m: 0, fontSize: '0.75rem', whiteSpace: 'pre-wrap' }}
                >
                  {log.map((line, index) => (
                    <Typography
                      key={index}
                      variant="body2"
                      color={severity === 'error' ? 'error.main' : 'text.primary'}
                    >
                      {line}
                    </Typography>
                  ))}
                </Box>
              </Paper>
            </Panel>
          )}
        </PanelGroup>
      </Box>

      <Dialog open={showPathDialog} maxWidth="sm" fullWidth>
        <DialogTitle>{t('setup.title', 'Welcome to GLACIER')}</DialogTitle>
        <DialogContent>
          <Typography sx={{ mb: 2 }}>
            {t('setup.description', 'Choose where to store your files.')}
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <TextField
              id="setup-config-folder"
              label={t('setup.config-folder', 'Config folder')}
              value={pendingConfigPath}
              onChange={(e) => setPendingConfigPath(e.target.value)}
              fullWidth
              size="small"
            />
            <Button variant="outlined" onClick={handlePickConfigDir}>
              {t('setup.browse', 'Browse')}
            </Button>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <TextField
              id="setup-documents-folder"
              label={t('setup.documents-folder', 'Documents folder')}
              value={pendingDocumentsPath}
              onChange={(e) => setPendingDocumentsPath(e.target.value)}
              fullWidth
              size="small"
            />
            <Button variant="outlined" onClick={handlePickDocumentsDir}>
              {t('setup.browse', 'Browse')}
            </Button>
          </Box>
          <Typography variant="caption" color="text.secondary">
            {t('setup.instances-note', 'Workflow instances go here')}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDefaults}>{t('setup.defaults', 'Defaults')}</Button>
          <Button variant="contained" onClick={handleConfirmPaths} id="setup-continue-button">
            {t('setup.continue', 'Continue')}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={showCatalogueParseErrors}
        onClose={() => setShowCatalogueParseErrors(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>{t('error.parsing-catalogue')}</DialogTitle>
        <DialogContent>
          <List dense>
            {catalogueParseResults.map((result, index) => (
              <ListItem key={index}>
                <ListItemIcon>
                  {result.success ? (
                    <CheckCircleIcon color="success" />
                  ) : (
                    <CancelIcon color="error" />
                  )}
                </ListItemIcon>
                <ListItemText
                  primary={result.source}
                  secondary={
                    result.success
                      ? t('error.catalogue-parse-success', { source: result.source })
                      : t('error.catalogue-parse-failure', {
                          source: result.source,
                          error: result.error
                        })
                  }
                />
              </ListItem>
            ))}
          </List>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowCatalogueParseErrors(false)} variant="contained">
            {t('common.close')}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={open} autoHideDuration={3000} onClose={() => setOpen(false)}>
        <Alert onClose={() => setOpen(false)} severity={severity} sx={{ width: '100%' }}>
          {message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
