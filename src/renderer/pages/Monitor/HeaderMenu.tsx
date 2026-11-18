import React from 'react';
import { Box, Typography } from '@mui/material';
import Button from '@mui/material/Button';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import { API } from '../../services/api.js';
import { WorkflowStatus } from '../../../types/types.js';
import { useTranslation } from 'react-i18next';

export default function HeaderMenu({ instance, logMessage, onRestart, onRefresh }) {
  const { t } = useTranslation();
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
  // Set when a graceful cancel did not stop the run; the menu entry then offers
  // the force cancel fallback instead.
  const [stopFailed, setStopFailed] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    setStopFailed(false);
    setBusy(false);
  }, [instance.id]);

  const handleExecutionActionsMenuClose = () => {
    setAnchorEl(null);
  };

  const handleExecutionCancel = async () => {
    handleExecutionActionsMenuClose();
    if (!window.confirm(t('monitor.execution.cancel-confirm'))) {
      return;
    }
    logMessage(`${t('monitor.execution.cancelling')}: ${instance.id}.`);
    setBusy(true);
    try {
      const result = await API.cancelWorkflowInstance(instance);
      if (!result.ok) {
        logMessage(`Cancel failed: ${result.error.message}`);
        setStopFailed(true);
        return;
      }
      if (result.data?.stopped === false) {
        setStopFailed(true);
        logMessage(t('monitor.execution.cancel-unconfirmed'));
        return;
      }
      setStopFailed(false);
      if (onRefresh) onRefresh();
    } finally {
      setBusy(false);
    }
  };

  const handleExecutionForceCancel = async () => {
    handleExecutionActionsMenuClose();
    if (!window.confirm(t('monitor.execution.force-cancel-confirm'))) {
      return;
    }
    logMessage(`${t('monitor.execution.force-cancelling')}: ${instance.id}.`);
    setBusy(true);
    try {
      const result = await API.killWorkflowInstance(instance);
      if (!result.ok) {
        logMessage(`Force cancel failed: ${result.error.message}`);
        return;
      }
      setStopFailed(false);
      if (onRefresh) onRefresh();
    } finally {
      setBusy(false);
    }
  };

  const handleExecutionResume = async () => {
    handleExecutionActionsMenuClose();
    if (!window.confirm(t('monitor.execution.resume-confirm'))) {
      return;
    }
    const result = await API.runWorkflow(instance, {}, { resume: true });
    if (!result.ok) {
      logMessage(`Resume failed: ${result.error.message}`);
      return;
    }
    setStopFailed(false);
    logMessage(`${t('monitor.execution.resuming')}: ${instance.id}.`);
    if (onRefresh) onRefresh();
  };

  const handleExecutionRestart = async () => {
    handleExecutionActionsMenuClose();
    if (!window.confirm(t('monitor.execution.restart-confirm'))) {
      return;
    }
    if (instance.status === WorkflowStatus.Running) {
      const result = await API.cancelWorkflowInstance(instance);
      if (!result.ok || result.data?.stopped === false) {
        setStopFailed(true);
        logMessage(t('monitor.execution.cancel-unconfirmed'));
        return;
      }
    }
    logMessage(`${t('monitor.execution.restarting')}: ${instance.id}.`);
    setStopFailed(false);
    if (onRestart) onRestart(instance.id);
  };

  const handleOpenResultsFolder = () => {
    API.openResultsFolder(instance);
  };

  return (
    <Box display="flex" justifyContent="space-between" alignItems="center" p={2}>
      <Button
        id="execution-actions-button"
        aria-controls={anchorEl ? 'execution-actions' : undefined}
        aria-haspopup="true"
        aria-expanded={anchorEl ? 'true' : undefined}
        onClick={(event) => setAnchorEl(event.currentTarget)}
        variant="contained"
      >
        {t('monitor.execution.actions')}
      </Button>
      <Menu
        id="execution-actions"
        aria-labelledby="execution-actions-label"
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleExecutionActionsMenuClose}
        anchorOrigin={{ vertical: 'top', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
      >
        {instance.status === WorkflowStatus.Running &&
          (stopFailed ? (
            <MenuItem
              id="execution-force-cancel"
              disabled={busy}
              onClick={() => handleExecutionForceCancel()}
            >
              {t('monitor.execution.force-cancel')}
            </MenuItem>
          ) : (
            <MenuItem id="execution-cancel" disabled={busy} onClick={() => handleExecutionCancel()}>
              {t('monitor.execution.cancel')}
            </MenuItem>
          ))}
        <MenuItem id="execution-resume" disabled={busy} onClick={() => handleExecutionResume()}>
          {t('monitor.execution.resume')}
        </MenuItem>
        <MenuItem id="execution-restart" disabled={busy} onClick={() => handleExecutionRestart()}>
          {t('monitor.execution.restart')}
        </MenuItem>
      </Menu>

      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          px: 2
        }}
      >
        <Typography variant="h6" sx={{ textAlign: 'center' }} data-testid="instance-name">
          {instance.name}
        </Typography>
        <Typography variant="subtitle1" sx={{ textAlign: 'center' }}>
          {instance.workflow_version.name}
        </Typography>
      </Box>

      <Button
        id="open-results-folder-button"
        onClick={() => handleOpenResultsFolder()}
        variant="contained"
      >
        {t('monitor.open-results-folder')}
      </Button>
    </Box>
  );
}
