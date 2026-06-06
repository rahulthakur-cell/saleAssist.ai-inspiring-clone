import {
  Controller,
  Get,
  Patch,
  Body,
  Query,
  Res,
  UseGuards,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Response } from 'express';
import { WidgetService } from './widget.service';
import { JwtAuthGuard, RbacGuard } from '../../common/guards';
import { RequirePermissions, TenantId, Public } from '../../common/decorators';
import { ConfigService } from '@nestjs/config';

@ApiTags('Widget')
@Controller('widget')
@UseGuards(JwtAuthGuard, RbacGuard)
@ApiBearerAuth()
export class WidgetController {
  constructor(
    private readonly widgetService: WidgetService,
    private readonly configService: ConfigService,
  ) {}

  @Get('config')
  @RequirePermissions('settings:manage')
  @ApiOperation({ summary: 'Get current widget configuration for tenant' })
  async getConfig(@TenantId() tenantId: string): Promise<any> {
    return this.widgetService.getOrCreateConfig(tenantId);
  }

  @Patch('config')
  @RequirePermissions('settings:manage')
  @ApiOperation({ summary: 'Update widget configuration for tenant' })
  async updateConfig(@TenantId() tenantId: string, @Body() body: any): Promise<any> {
    return this.widgetService.updateConfig(tenantId, body);
  }

  @Get('embed')
  @Public() // Allow public visitors to read the widget.js script bundle
  @ApiOperation({ summary: 'Serve the widget script loader bundle' })
  async serveEmbed(
    @Query('tenantId') tenantId: string,
    @Res() res: Response,
  ): Promise<any> {
    if (!tenantId) {
      res.setHeader('Content-Type', 'application/javascript');
      return res.status(HttpStatus.BAD_REQUEST).send('// Error: tenantId query parameter is required');
    }

    try {
      const config = await this.widgetService.getOrCreateConfig(tenantId);
      const appUrl = this.configService.get<string>('APP_URL', 'http://localhost:3000');
      
      const jsContent = this.generateEmbedScript(tenantId, config, appUrl);
      
      res.setHeader('Content-Type', 'application/javascript');
      return res.status(HttpStatus.OK).send(jsContent);
    } catch (err: any) {
      res.setHeader('Content-Type', 'application/javascript');
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).send(`// Error embedding widget: ${err.message}`);
    }
  }

  private generateEmbedScript(tenantId: string, config: any, appUrl: string): string {
    const safeConfig = {
      position: config.position || 'BOTTOM_RIGHT',
      primaryColor: config.primaryColor || '#6366f1',
      secondaryColor: config.secondaryColor || '#8b5cf6',
      borderRadius: config.borderRadius ?? 16,
      greeting: config.greeting || 'Hi! How can we help you?',
      isActive: config.isActive ?? true,
    };

    return `(function() {
  if (document.getElementById('saleassist-widget-root')) return;

  var config = ${JSON.stringify(safeConfig)};
  if (!config.isActive) return;

  var root = document.createElement('div');
  root.id = 'saleassist-widget-root';
  root.style.position = 'fixed';
  root.style.zIndex = '999999';
  
  var pos = config.position;
  if (pos.indexOf('BOTTOM') !== -1) {
    root.style.bottom = '24px';
  } else {
    root.style.top = '24px';
  }
  
  if (pos.indexOf('RIGHT') !== -1) {
    root.style.right = '24px';
  } else {
    root.style.left = '24px';
  }

  var style = document.createElement('style');
  style.innerHTML = [
    '#saleassist-widget-bubble {',
    '  width: 56px;',
    '  height: 56px;',
    '  border-radius: 50%;',
    '  background: linear-gradient(135deg, ' + config.primaryColor + ', ' + config.secondaryColor + ');',
    '  box-shadow: 0 4px 16px rgba(0,0,0,0.2);',
    '  cursor: pointer;',
    '  display: flex;',
    '  align-items: center;',
    '  justify-content: center;',
    '  transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);',
    '}',
    '#saleassist-widget-bubble:hover {',
    '  transform: scale(1.1);',
    '}',
    '#saleassist-widget-iframe-container {',
    '  width: 380px;',
    '  height: 600px;',
    '  max-height: calc(100vh - 100px);',
    '  box-shadow: 0 12px 36px rgba(0,0,0,0.15);',
    '  border-radius: ' + config.borderRadius + 'px;',
    '  overflow: hidden;',
    '  border: 1px solid rgba(0,0,0,0.1);',
    '  background: #ffffff;',
    '  position: absolute;',
    '  bottom: 72px;',
    '  display: none;',
    '  opacity: 0;',
    '  transform: translateY(20px);',
    '  transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);',
    '}',
    '#saleassist-widget-iframe-container.open {',
    '  display: block;',
    '  opacity: 1;',
    '  transform: translateY(0);',
    '}',
    '#saleassist-widget-tooltip {',
    '  position: absolute;',
    '  bottom: 72px;',
    '  background: #18181b;',
    '  border: 1px solid #27272a;',
    '  color: #f4f4f5;',
    '  padding: 10px 14px;',
    '  border-radius: 10px;',
    '  font-size: 13px;',
    '  font-family: system-ui, -apple-system, sans-serif;',
    '  box-shadow: 0 4px 12px rgba(0,0,0,0.25);',
    '  white-space: nowrap;',
    '  transition: opacity 0.5s;',
    '}'
  ].join('\\n');

  if (pos.indexOf('RIGHT') !== -1) {
    style.innerHTML += '\\n#saleassist-widget-iframe-container { right: 0; }\\n#saleassist-widget-tooltip { right: 0; }';
  } else {
    style.innerHTML += '\\n#saleassist-widget-iframe-container { left: 0; }\\n#saleassist-widget-tooltip { left: 0; }';
  }

  document.head.appendChild(style);

  root.innerHTML = [
    '<div id="saleassist-widget-tooltip">' + config.greeting + '</div>',
    '<div id="saleassist-widget-iframe-container">',
    '  <iframe src="' + appUrl + '/widget-iframe?tenantId=' + tenantId + '" style="width:100%; height:100%; border:none;" />',
    '</div>',
    '<div id="saleassist-widget-bubble">',
    '  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">',
    '    <polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" ry="2" />',
    '  </svg>',
    '</div>'
  ].join('\\n');

  document.body.appendChild(root);

  var bubble = document.getElementById('saleassist-widget-bubble');
  var iframeContainer = document.getElementById('saleassist-widget-iframe-container');
  var tooltip = document.getElementById('saleassist-widget-tooltip');

  setTimeout(function() {
    if (tooltip) tooltip.style.opacity = '0';
    setTimeout(function() {
      if (tooltip && tooltip.parentNode) tooltip.parentNode.removeChild(tooltip);
    }, 500);
  }, 5000);

  bubble.addEventListener('click', function() {
    var isOpen = iframeContainer.classList.contains('open');
    if (isOpen) {
      iframeContainer.classList.remove('open');
      setTimeout(function() { iframeContainer.style.display = 'none'; }, 300);
    } else {
      iframeContainer.style.display = 'block';
      setTimeout(function() { iframeContainer.classList.add('open'); }, 10);
      if (tooltip && tooltip.parentNode) tooltip.parentNode.removeChild(tooltip);
    }
  });

  window.addEventListener('message', function(event) {
    if (event.data && event.data.type === 'CLOSE_WIDGET') {
      iframeContainer.classList.remove('open');
      setTimeout(function() { iframeContainer.style.display = 'none'; }, 300);
    }
  });
})();`;
  }
}
